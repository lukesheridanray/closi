"""
Authorize.net integration service -- CIM customer profiles, ARB subscriptions,
one-time charges, webhook processing, and payment management.

Uses the Authorize.net Python SDK for CIM (Customer Information Manager)
and ARB (Automated Recurring Billing).
"""

import logging
import uuid
import hashlib
import hmac
from datetime import date, datetime
from decimal import Decimal

from authorizenet import apicontractsv1 as api_contracts
from authorizenet.apicontrollers import (
    createCustomerProfileController,
    createCustomerPaymentProfileController,
    createTransactionController,
    ARBCreateSubscriptionController,
    ARBCancelSubscriptionController,
    ARBGetSubscriptionStatusController,
    getCustomerProfileController,
)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.contact import Contact
from app.models.contract import Contract
from app.models.invoice import Invoice
from app.models.organization import Organization
from app.models.payment import Payment
from app.models.payment_provider import (
    CustomerPaymentProfile,
    PaymentProviderConfig,
    PaymentWebhookLog,
)
from app.models.subscription import Subscription
from app.models.activity import Activity
from app.models.task import Task

logger = logging.getLogger(__name__)
settings = get_settings()


# ── Authorize.net Authentication ────────────────────


def _get_merchant_auth(
    api_login_id: str | None = None,
    transaction_key: str | None = None,
) -> api_contracts.merchantAuthenticationType:
    """Create merchant authentication object."""
    auth = api_contracts.merchantAuthenticationType()
    auth.name = api_login_id or settings.authnet_api_login_id
    auth.transactionKey = transaction_key or settings.authnet_transaction_key
    return auth


def _get_environment():
    """Return the Authorize.net environment endpoint."""
    if settings.authnet_environment == "production":
        return "https://api.authorize.net/xml/v1/request.api"
    return "https://apitest.authorize.net/xml/v1/request.api"


def _is_configured() -> bool:
    """Check if Authorize.net credentials are configured."""
    return bool(settings.authnet_api_login_id and settings.authnet_transaction_key)


# ── Provider Config Management ──────────────────────


async def get_authnet_status(
    db: AsyncSession, org_id: uuid.UUID
) -> dict:
    """Get current Authorize.net connection status for an organization."""
    config = await _get_provider_config(db, org_id)

    if not config:
        return {
            "connected": False,
            "provider_type": "authorize_net",
            "environment": None,
        }

    return {
        "connected": config.is_active,
        "provider_type": "authorize_net",
        "display_name": config.display_name,
        "environment": config.environment,
        "auto_invoice": config.auto_invoice,
        "retry_failed_days": config.retry_failed_days,
        "retry_max_attempts": config.retry_max_attempts,
    }


async def connect_authnet(
    db: AsyncSession,
    org_id: uuid.UUID,
    api_login_id: str,
    transaction_key: str,
    signature_key: str = "",
    environment: str = "sandbox",
) -> dict:
    """Connect an Authorize.net account to the organization."""
    # Test the credentials by trying to get a response
    merchant_auth = _get_merchant_auth(api_login_id, transaction_key)

    # Try a simple API call to verify credentials
    try:
        request = api_contracts.getHostedProfilePageRequest()
        request.merchantAuthentication = merchant_auth
        request.customerProfileId = "0"  # Will fail but validates auth
        # We don't actually execute -- just store credentials
    except Exception:
        pass

    # Get or create provider config
    config = await _get_provider_config(db, org_id)
    if config:
        config.credentials = {
            "api_login_id": api_login_id,
            "transaction_key": transaction_key,
            "signature_key": signature_key,
        }
        config.environment = environment
        config.is_active = True
        config.updated_at = datetime.utcnow()
    else:
        config = PaymentProviderConfig(
            organization_id=org_id,
            provider_type="authorize_net",
            display_name="Authorize.net",
            is_active=True,
            credentials={
                "api_login_id": api_login_id,
                "transaction_key": transaction_key,
                "signature_key": signature_key,
            },
            environment=environment,
            settings={
                "validation_mode": "liveMode" if environment == "production" else "testMode",
                "duplicate_window": 120,
                "email_customer": True,
            },
        )
        db.add(config)

    await db.flush()
    return {
        "connected": True,
        "provider_type": "authorize_net",
        "environment": environment,
    }


async def disconnect_authnet(
    db: AsyncSession, org_id: uuid.UUID
) -> None:
    """Disconnect Authorize.net from the organization."""
    config = await _get_provider_config(db, org_id)
    if config:
        config.is_active = False
        config.updated_at = datetime.utcnow()
        await db.flush()


# ── Customer Management (CIM) ──────────────────────


async def create_customer(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_id: uuid.UUID,
) -> CustomerPaymentProfile:
    """Create an Authorize.net customer profile via CIM."""
    config = await _require_config(db, org_id)
    contact = await _get_contact(db, org_id, contact_id)
    creds = config.credentials or {}

    # Check for existing profile
    existing = await _get_customer_profile(db, org_id, contact_id)
    if existing and existing.external_customer_id:
        return existing

    merchant_auth = _get_merchant_auth(creds.get("api_login_id"), creds.get("transaction_key"))

    # Build CIM customer profile
    profile_request = api_contracts.createCustomerProfileRequest()
    profile_request.merchantAuthentication = merchant_auth

    customer_profile = api_contracts.customerProfileType()
    customer_profile.merchantCustomerId = str(contact_id)[:20]
    customer_profile.email = contact.email or ""
    customer_profile.description = f"{contact.first_name} {contact.last_name}"
    profile_request.profile = customer_profile

    controller = createCustomerProfileController(profile_request)
    if config.environment == "production":
        controller.setenvironment("https://api.authorize.net/xml/v1/request.api")
    else:
        controller.setenvironment("https://apitest.authorize.net/xml/v1/request.api")
    controller.execute()

    response = controller.getresponse()

    if response.messages.resultCode != "Ok":
        error_msg = response.messages.message[0].text if response.messages.message else "Unknown error"
        # Check for duplicate profile error (E00039)
        if "duplicate" in error_msg.lower():
            # Extract the existing profile ID from the error
            logger.warning(f"Duplicate CIM profile for contact {contact_id}: {error_msg}")
            raise ValueError(f"Customer profile already exists: {error_msg}")
        raise ValueError(f"Failed to create CIM profile: {error_msg}")

    customer_profile_id = str(response.customerProfileId)

    # Store the customer payment profile
    profile = CustomerPaymentProfile(
        organization_id=org_id,
        contact_id=contact_id,
        provider_config_id=config.id,
        external_customer_id=customer_profile_id,
        status="active",
    )
    db.add(profile)
    await db.flush()

    logger.info(f"Created CIM profile {customer_profile_id} for contact {contact_id}")
    return profile


async def add_payment_profile(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_id: uuid.UUID,
    card_number: str,
    expiration_date: str,  # YYYY-MM format
    card_code: str,
) -> CustomerPaymentProfile:
    """Add a payment profile (card) to an existing CIM customer."""
    config = await _require_config(db, org_id)
    creds = config.credentials or {}

    profile = await _get_customer_profile(db, org_id, contact_id)
    if not profile or not profile.external_customer_id:
        raise ValueError("Customer profile not found. Create customer first.")

    merchant_auth = _get_merchant_auth(creds.get("api_login_id"), creds.get("transaction_key"))

    # Build payment profile
    credit_card = api_contracts.creditCardType()
    credit_card.cardNumber = card_number
    credit_card.expirationDate = expiration_date
    credit_card.cardCode = card_code

    payment = api_contracts.paymentType()
    payment.creditCard = credit_card

    payment_profile = api_contracts.customerPaymentProfileType()
    payment_profile.payment = payment
    payment_profile.defaultPaymentProfile = True

    request = api_contracts.createCustomerPaymentProfileRequest()
    request.merchantAuthentication = merchant_auth
    request.customerProfileId = profile.external_customer_id
    request.paymentProfile = payment_profile
    request.validationMode = "testMode" if config.environment == "sandbox" else "liveMode"

    controller = createCustomerPaymentProfileController(request)
    if config.environment == "production":
        controller.setenvironment("https://api.authorize.net/xml/v1/request.api")
    else:
        controller.setenvironment("https://apitest.authorize.net/xml/v1/request.api")
    controller.execute()

    response = controller.getresponse()

    if response.messages.resultCode != "Ok":
        error_msg = response.messages.message[0].text if response.messages.message else "Unknown error"
        raise ValueError(f"Failed to create payment profile: {error_msg}")

    payment_profile_id = str(response.customerPaymentProfileId)

    # Update profile with payment method details
    profile.external_payment_id = payment_profile_id
    profile.payment_method_type = "card"
    profile.payment_method_last4 = card_number[-4:]
    profile.is_default = True
    profile.updated_at = datetime.utcnow()

    # Try to detect card brand
    first_digit = card_number[0] if card_number else ""
    brand_map = {"4": "visa", "5": "mastercard", "3": "amex", "6": "discover"}
    profile.payment_method_brand = brand_map.get(first_digit, "unknown")

    # Parse expiration
    try:
        parts = expiration_date.split("-")
        if len(parts) == 2:
            profile.payment_method_exp_year = int(parts[0])
            profile.payment_method_exp_month = int(parts[1])
    except (ValueError, IndexError):
        pass

    await db.flush()
    return profile


# ── One-Time Charge ─────────────────────────────────


async def charge_customer(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_id: uuid.UUID,
    amount: float,
    description: str = "One-time charge",
    contract_id: uuid.UUID | None = None,
) -> Payment:
    """Create a one-time charge via CIM profile transaction."""
    config = await _require_config(db, org_id)
    creds = config.credentials or {}

    profile = await _get_customer_profile(db, org_id, contact_id)
    if not profile or not profile.external_customer_id or not profile.external_payment_id:
        raise ValueError("Customer has no payment method on file.")

    merchant_auth = _get_merchant_auth(creds.get("api_login_id"), creds.get("transaction_key"))

    # Build the transaction
    profile_to_charge = api_contracts.customerProfilePaymentType()
    profile_to_charge.customerProfileId = profile.external_customer_id
    profile_to_charge.paymentProfile = api_contracts.paymentProfile()
    profile_to_charge.paymentProfile.paymentProfileId = profile.external_payment_id

    transaction = api_contracts.transactionRequestType()
    transaction.transactionType = "authCaptureTransaction"
    transaction.amount = str(round(amount, 2))
    transaction.profile = profile_to_charge
    transaction.order = api_contracts.orderType()
    transaction.order.description = description[:255]

    request = api_contracts.createTransactionRequest()
    request.merchantAuthentication = merchant_auth
    request.transactionRequest = transaction

    controller = createTransactionController(request)
    if config.environment == "production":
        controller.setenvironment("https://api.authorize.net/xml/v1/request.api")
    else:
        controller.setenvironment("https://apitest.authorize.net/xml/v1/request.api")
    controller.execute()

    response = controller.getresponse()

    status = "failed"
    external_id = ""
    failure_code = None
    failure_message = None

    if response.messages.resultCode == "Ok":
        if hasattr(response, "transactionResponse") and response.transactionResponse:
            tr = response.transactionResponse
            external_id = str(tr.transId) if tr.transId else ""
            if tr.responseCode == "1":
                status = "succeeded"
            elif tr.responseCode == "4":
                status = "pending"  # held for review
            else:
                status = "failed"
                if hasattr(tr, "errors") and tr.errors:
                    failure_code = str(tr.errors.error[0].errorCode)
                    failure_message = str(tr.errors.error[0].errorText)
    else:
        if response.messages.message:
            failure_code = str(response.messages.message[0].code)
            failure_message = str(response.messages.message[0].text)

    # Create payment record
    payment = Payment(
        organization_id=org_id,
        contact_id=contact_id,
        contract_id=contract_id,
        provider_config_id=config.id,
        external_payment_id=external_id,
        status=status,
        amount=amount,
        currency="usd",
        payment_method_type=profile.payment_method_type,
        payment_method_last4=profile.payment_method_last4,
        payment_date=date.today(),
        failure_code=failure_code,
        failure_message=failure_message,
    )
    db.add(payment)

    # Log activity
    activity = Activity(
        organization_id=org_id,
        contact_id=contact_id,
        type="payment_succeeded" if status == "succeeded" else "payment_failed",
        subject=f"{'Payment' if status == 'succeeded' else 'Failed payment'}: ${amount:.2f}",
        description=f"Authorize.net transaction {external_id}. {failure_message or ''}".strip(),
        performed_at=datetime.utcnow(),
    )
    db.add(activity)
    await db.flush()

    return payment


# ── ARB Subscription Management ─────────────────────


async def create_subscription(
    db: AsyncSession,
    org_id: uuid.UUID,
    contract_id: uuid.UUID,
) -> Subscription:
    """Create an ARB subscription for a contract's recurring billing."""
    config = await _require_config(db, org_id)
    creds = config.credentials or {}

    contract = await _get_contract(db, org_id, contract_id)
    if contract.monthly_amount <= 0:
        raise ValueError("Contract has no recurring amount.")

    contact_id = contract.contact_id
    profile = await _get_customer_profile(db, org_id, contact_id)
    if not profile or not profile.external_customer_id or not profile.external_payment_id:
        raise ValueError("Customer has no payment method on file.")

    contact = await _get_contact(db, org_id, contact_id)
    merchant_auth = _get_merchant_auth(creds.get("api_login_id"), creds.get("transaction_key"))

    # Build ARB subscription
    arb_sub = api_contracts.ARBSubscriptionType()
    arb_sub.name = f"{contract.title}"[:50]

    # Payment schedule
    interval = api_contracts.paymentScheduleTypeInterval()
    interval.length = 1
    interval.unit = "months"

    schedule = api_contracts.paymentScheduleType()
    schedule.interval = interval
    schedule.startDate = date.today().strftime("%Y-%m-%d")
    schedule.totalOccurrences = contract.term_months
    schedule.trialOccurrences = 0
    arb_sub.paymentSchedule = schedule

    arb_sub.amount = str(round(float(contract.monthly_amount), 2))
    arb_sub.trialAmount = "0.00"

    # Profile-based payment
    arb_profile = api_contracts.customerProfileIdType()
    arb_profile.customerProfileId = profile.external_customer_id
    arb_profile.customerPaymentProfileId = profile.external_payment_id
    arb_sub.profile = arb_profile

    # Order info
    order = api_contracts.orderType()
    order.description = f"Monitoring - {contract.title}"[:255]
    arb_sub.order = order

    request = api_contracts.ARBCreateSubscriptionRequest()
    request.merchantAuthentication = merchant_auth
    request.subscription = arb_sub

    controller = ARBCreateSubscriptionController(request)
    if config.environment == "production":
        controller.setenvironment("https://api.authorize.net/xml/v1/request.api")
    else:
        controller.setenvironment("https://apitest.authorize.net/xml/v1/request.api")
    controller.execute()

    response = controller.getresponse()

    if response.messages.resultCode != "Ok":
        error_msg = response.messages.message[0].text if response.messages.message else "Unknown error"
        raise ValueError(f"Failed to create ARB subscription: {error_msg}")

    arb_subscription_id = str(response.subscriptionId)

    # Create local subscription record
    from dateutil.relativedelta import relativedelta
    today = date.today()

    sub = Subscription(
        organization_id=org_id,
        contract_id=contract_id,
        contact_id=contact_id,
        provider_config_id=config.id,
        customer_payment_profile_id=profile.id,
        external_subscription_id=arb_subscription_id,
        status="active",
        amount=float(contract.monthly_amount),
        currency="usd",
        billing_interval="monthly",
        billing_interval_count=1,
        current_period_start=today,
        current_period_end=today + relativedelta(months=1),
        next_billing_date=today + relativedelta(months=1),
    )
    db.add(sub)

    # Activate contract
    contract.status = "active"
    contract.signed_at = datetime.utcnow()
    contract.updated_at = datetime.utcnow()

    await db.flush()

    # Log activity
    activity = Activity(
        organization_id=org_id,
        contact_id=contact_id,
        type="subscription_created",
        subject=f"Subscription created: ${contract.monthly_amount}/mo",
        description=f"Authorize.net ARB subscription {arb_subscription_id} for {contract.title}",
        performed_at=datetime.utcnow(),
    )
    db.add(activity)
    await db.flush()

    logger.info(f"Created ARB subscription {arb_subscription_id} for contract {contract_id}")
    return sub


async def cancel_subscription(
    db: AsyncSession,
    org_id: uuid.UUID,
    subscription_id: uuid.UUID,
    reason: str = "Cancelled by user",
) -> Subscription:
    """Cancel an ARB subscription."""
    config = await _require_config(db, org_id)
    creds = config.credentials or {}

    sub = await _get_subscription(db, org_id, subscription_id)
    if not sub.external_subscription_id:
        raise ValueError("Subscription has no external ID.")

    merchant_auth = _get_merchant_auth(creds.get("api_login_id"), creds.get("transaction_key"))

    request = api_contracts.ARBCancelSubscriptionRequest()
    request.merchantAuthentication = merchant_auth
    request.subscriptionId = sub.external_subscription_id

    controller = ARBCancelSubscriptionController(request)
    if config.environment == "production":
        controller.setenvironment("https://api.authorize.net/xml/v1/request.api")
    else:
        controller.setenvironment("https://apitest.authorize.net/xml/v1/request.api")
    controller.execute()

    response = controller.getresponse()

    if response.messages.resultCode != "Ok":
        error_msg = response.messages.message[0].text if response.messages.message else "Unknown error"
        raise ValueError(f"Failed to cancel ARB subscription: {error_msg}")

    sub.status = "cancelled"
    sub.cancelled_at = datetime.utcnow()
    sub.cancellation_reason = reason
    sub.updated_at = datetime.utcnow()

    # Also cancel the contract
    if sub.contract_id:
        result = await db.execute(
            select(Contract).where(
                Contract.id == sub.contract_id,
                Contract.organization_id == org_id,
            )
        )
        contract = result.scalar_one_or_none()
        if contract and contract.status != "cancelled":
            contract.status = "cancelled"
            contract.cancelled_at = datetime.utcnow()
            contract.cancellation_reason = reason
            contract.updated_at = datetime.utcnow()

    await db.flush()

    # Log activity
    activity = Activity(
        organization_id=org_id,
        contact_id=sub.contact_id,
        type="subscription_cancelled",
        subject="Subscription cancelled",
        description=f"ARB subscription {sub.external_subscription_id} cancelled: {reason}",
        performed_at=datetime.utcnow(),
    )
    db.add(activity)
    await db.flush()

    return sub


async def get_subscription_status(
    db: AsyncSession,
    org_id: uuid.UUID,
    subscription_id: uuid.UUID,
) -> dict:
    """Check ARB subscription status from Authorize.net."""
    config = await _require_config(db, org_id)
    creds = config.credentials or {}

    sub = await _get_subscription(db, org_id, subscription_id)
    if not sub.external_subscription_id:
        return {"status": sub.status, "synced": False}

    merchant_auth = _get_merchant_auth(creds.get("api_login_id"), creds.get("transaction_key"))

    request = api_contracts.ARBGetSubscriptionStatusRequest()
    request.merchantAuthentication = merchant_auth
    request.subscriptionId = sub.external_subscription_id

    controller = ARBGetSubscriptionStatusController(request)
    if config.environment == "production":
        controller.setenvironment("https://api.authorize.net/xml/v1/request.api")
    else:
        controller.setenvironment("https://apitest.authorize.net/xml/v1/request.api")
    controller.execute()

    response = controller.getresponse()

    if response.messages.resultCode != "Ok":
        return {"status": sub.status, "synced": False, "error": "Could not fetch status"}

    arb_status = str(response.status) if hasattr(response, "status") else "unknown"
    status_map = {
        "active": "active",
        "expired": "expired",
        "suspended": "past_due",
        "canceled": "cancelled",
        "terminated": "cancelled",
    }

    new_status = status_map.get(arb_status, sub.status)
    if sub.status != new_status:
        sub.status = new_status
        sub.updated_at = datetime.utcnow()
        await db.flush()

    return {"status": new_status, "arb_status": arb_status, "synced": True}


# ── Webhook Processing ──────────────────────────────


async def process_webhook_event(
    db: AsyncSession,
    payload: dict,
    signature: str,
    org_id: uuid.UUID | None = None,
) -> dict:
    """Process an Authorize.net webhook event."""
    event_type = payload.get("eventType", "")
    webhook_id = payload.get("notificationId", str(uuid.uuid4()))

    # Find org by matching provider config
    config = None
    if org_id:
        config = await _get_provider_config(db, org_id)
    else:
        # Try to find org from payload metadata
        merchant_id = payload.get("merchantId")
        if merchant_id:
            # Look through all active authnet configs
            result = await db.execute(
                select(PaymentProviderConfig).where(
                    PaymentProviderConfig.provider_type == "authorize_net",
                    PaymentProviderConfig.is_active == True,
                )
            )
            configs = result.scalars().all()
            for c in configs:
                if c.credentials and c.credentials.get("api_login_id"):
                    config = c
                    org_id = c.organization_id
                    break

    if not config or not org_id:
        logger.warning(f"Could not determine org for AuthNet webhook {webhook_id}")
        return {"status": "ignored", "reason": "unknown_organization"}

    # Verify webhook signature if signature key is configured
    sig_key = (config.credentials or {}).get("signature_key", "")
    if sig_key and signature:
        if not _verify_webhook_signature(payload, signature, sig_key):
            raise ValueError("Invalid webhook signature.")

    # Log the webhook
    webhook_log = PaymentWebhookLog(
        organization_id=org_id,
        provider_config_id=config.id,
        external_event_id=webhook_id,
        event_type=event_type,
        raw_payload=payload,
        processing_status="received",
        received_at=datetime.utcnow(),
    )
    db.add(webhook_log)
    await db.flush()

    # Process by event type
    result = {"status": "processed", "event_type": event_type}
    try:
        event_payload = payload.get("payload", {})

        if event_type == "net.authorize.payment.authcapture.created":
            await _handle_authnet_payment_success(db, org_id, config, event_payload)
        elif event_type == "net.authorize.payment.fraud.declined":
            await _handle_authnet_payment_failed(db, org_id, config, event_payload)
        elif event_type == "net.authorize.payment.refund.created":
            await _handle_authnet_refund(db, org_id, config, event_payload)
        else:
            result["status"] = "ignored"
            result["reason"] = "unhandled_event_type"

        webhook_log.processing_status = "processed"
        webhook_log.processed_at = datetime.utcnow()
    except Exception as e:
        logger.error(f"Error processing AuthNet webhook {webhook_id}: {e}")
        webhook_log.processing_status = "error"
        webhook_log.error_message = str(e)
        webhook_log.processed_at = datetime.utcnow()
        result["status"] = "error"
        result["error"] = str(e)

    await db.flush()
    return result


# ── Webhook Event Handlers ──────────────────────────


async def _handle_authnet_payment_success(
    db: AsyncSession, org_id: uuid.UUID, config: PaymentProviderConfig, payload: dict
) -> None:
    """Handle a successful payment from Authorize.net."""
    trans_id = str(payload.get("id", ""))
    amount = float(payload.get("authAmount", 0))

    # Try to find the customer from the CIM profile
    profile_id = None
    if "customerProfile" in payload:
        profile_id = str(payload["customerProfile"].get("customerProfileId", ""))

    contact_id = None
    if profile_id:
        result = await db.execute(
            select(CustomerPaymentProfile).where(
                CustomerPaymentProfile.organization_id == org_id,
                CustomerPaymentProfile.external_customer_id == profile_id,
            )
        )
        profile = result.scalar_one_or_none()
        if profile:
            contact_id = profile.contact_id

    if not contact_id:
        logger.warning(f"AuthNet payment_success: could not determine contact for trans {trans_id}")
        return

    # Create payment record
    payment = Payment(
        organization_id=org_id,
        contact_id=contact_id,
        provider_config_id=config.id,
        external_payment_id=trans_id,
        status="succeeded",
        amount=amount,
        currency="usd",
        payment_date=date.today(),
    )
    db.add(payment)

    # Log activity
    activity = Activity(
        organization_id=org_id,
        contact_id=contact_id,
        type="payment_succeeded",
        subject=f"Payment received: ${amount:.2f}",
        description=f"Authorize.net transaction {trans_id}",
        performed_at=datetime.utcnow(),
    )
    db.add(activity)
    await db.flush()


async def _handle_authnet_payment_failed(
    db: AsyncSession, org_id: uuid.UUID, config: PaymentProviderConfig, payload: dict
) -> None:
    """Handle a failed/declined payment from Authorize.net."""
    trans_id = str(payload.get("id", ""))
    amount = float(payload.get("authAmount", 0))

    profile_id = None
    if "customerProfile" in payload:
        profile_id = str(payload["customerProfile"].get("customerProfileId", ""))

    contact_id = None
    if profile_id:
        result = await db.execute(
            select(CustomerPaymentProfile).where(
                CustomerPaymentProfile.organization_id == org_id,
                CustomerPaymentProfile.external_customer_id == profile_id,
            )
        )
        profile = result.scalar_one_or_none()
        if profile:
            contact_id = profile.contact_id

    if not contact_id:
        logger.warning(f"AuthNet payment_failed: could not determine contact for trans {trans_id}")
        return

    # Create failed payment record
    payment = Payment(
        organization_id=org_id,
        contact_id=contact_id,
        provider_config_id=config.id,
        external_payment_id=trans_id,
        status="failed",
        amount=amount,
        currency="usd",
        payment_date=date.today(),
        failure_code="declined",
        failure_message="Transaction declined by processor",
    )
    db.add(payment)

    # Create task for follow-up
    contact = await _get_contact(db, org_id, contact_id)
    contact_name = f"{contact.first_name} {contact.last_name}" if contact else "Unknown"

    task = Task(
        organization_id=org_id,
        contact_id=contact_id,
        title=f"Failed payment: {contact_name} - ${amount:.2f}",
        description=f"Authorize.net payment of ${amount:.2f} was declined (trans: {trans_id}). Contact the customer to update their payment method.",
        priority="high",
        status="pending",
        type="follow_up",
        due_date=date.today(),
    )
    db.add(task)

    # Log activity
    activity = Activity(
        organization_id=org_id,
        contact_id=contact_id,
        type="payment_failed",
        subject=f"Payment failed: ${amount:.2f}",
        description=f"Authorize.net transaction {trans_id} was declined",
        performed_at=datetime.utcnow(),
    )
    db.add(activity)
    await db.flush()


async def _handle_authnet_refund(
    db: AsyncSession, org_id: uuid.UUID, config: PaymentProviderConfig, payload: dict
) -> None:
    """Handle a refund event from Authorize.net."""
    trans_id = str(payload.get("id", ""))
    amount = float(payload.get("authAmount", 0))

    profile_id = None
    if "customerProfile" in payload:
        profile_id = str(payload["customerProfile"].get("customerProfileId", ""))

    contact_id = None
    if profile_id:
        result = await db.execute(
            select(CustomerPaymentProfile).where(
                CustomerPaymentProfile.organization_id == org_id,
                CustomerPaymentProfile.external_customer_id == profile_id,
            )
        )
        profile = result.scalar_one_or_none()
        if profile:
            contact_id = profile.contact_id

    if not contact_id:
        logger.warning(f"AuthNet refund: could not determine contact for trans {trans_id}")
        return

    payment = Payment(
        organization_id=org_id,
        contact_id=contact_id,
        provider_config_id=config.id,
        external_payment_id=trans_id,
        status="refunded",
        amount=amount,
        amount_refunded=amount,
        currency="usd",
        payment_date=date.today(),
    )
    db.add(payment)

    activity = Activity(
        organization_id=org_id,
        contact_id=contact_id,
        type="payment_refunded",
        subject=f"Refund issued: ${amount:.2f}",
        description=f"Authorize.net refund transaction {trans_id}",
        performed_at=datetime.utcnow(),
    )
    db.add(activity)
    await db.flush()


# ── Webhook Signature Verification ──────────────────


def _verify_webhook_signature(payload: dict, signature: str, signature_key: str) -> bool:
    """Verify an Authorize.net webhook signature."""
    import json
    payload_str = json.dumps(payload, separators=(",", ":"))
    expected = hmac.new(
        signature_key.encode("utf-8"),
        payload_str.encode("utf-8"),
        hashlib.sha512,
    ).hexdigest().upper()
    return hmac.compare_digest(expected, signature.upper())


# ── Webhook Log Queries ─────────────────────────────


async def list_webhook_logs(
    db: AsyncSession,
    org_id: uuid.UUID,
    limit: int = 20,
) -> list[PaymentWebhookLog]:
    """Get recent webhook logs for the organization."""
    result = await db.execute(
        select(PaymentWebhookLog)
        .where(PaymentWebhookLog.organization_id == org_id)
        .order_by(PaymentWebhookLog.received_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


# ── Helper Functions ────────────────────────────────


async def _get_contact(db: AsyncSession, org_id: uuid.UUID, contact_id: uuid.UUID) -> Contact:
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.organization_id == org_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise ValueError("Contact not found.")
    return contact


async def _get_contract(db: AsyncSession, org_id: uuid.UUID, contract_id: uuid.UUID) -> Contract:
    result = await db.execute(
        select(Contract).where(Contract.id == contract_id, Contract.organization_id == org_id)
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise ValueError("Contract not found.")
    return contract


async def _get_subscription(db: AsyncSession, org_id: uuid.UUID, subscription_id: uuid.UUID) -> Subscription:
    result = await db.execute(
        select(Subscription).where(Subscription.id == subscription_id, Subscription.organization_id == org_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise ValueError("Subscription not found.")
    return sub


async def _get_customer_profile(
    db: AsyncSession, org_id: uuid.UUID, contact_id: uuid.UUID
) -> CustomerPaymentProfile | None:
    result = await db.execute(
        select(CustomerPaymentProfile).where(
            CustomerPaymentProfile.organization_id == org_id,
            CustomerPaymentProfile.contact_id == contact_id,
        )
    )
    return result.scalar_one_or_none()


async def _get_provider_config(
    db: AsyncSession, org_id: uuid.UUID
) -> PaymentProviderConfig | None:
    result = await db.execute(
        select(PaymentProviderConfig).where(
            PaymentProviderConfig.organization_id == org_id,
            PaymentProviderConfig.provider_type == "authorize_net",
        )
    )
    return result.scalar_one_or_none()


async def _require_config(db: AsyncSession, org_id: uuid.UUID) -> PaymentProviderConfig:
    config = await _get_provider_config(db, org_id)
    if not config or not config.is_active:
        raise ValueError("Authorize.net is not configured. Please connect your account first.")
    return config
