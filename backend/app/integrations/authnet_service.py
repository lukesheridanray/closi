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
    getHostedProfilePageController,
    getSettledBatchListController,
    getTransactionListController,
    getUnsettledTransactionListController,
    getTransactionDetailsController,
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


async def get_customer_profile(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_id: uuid.UUID,
) -> CustomerPaymentProfile:
    """Get the stored customer payment profile for a contact."""
    profile = await _get_customer_profile(db, org_id, contact_id)
    if not profile:
        raise ValueError("Customer payment profile not found.")
    return profile


async def sync_customer_profile(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_id: uuid.UUID,
) -> CustomerPaymentProfile:
    """Sync masked payment method details from Authorize.net into the local profile."""
    config = await _require_config(db, org_id)
    creds = config.credentials or {}
    profile = await _get_customer_profile(db, org_id, contact_id)
    if not profile or not profile.external_customer_id:
        raise ValueError("Customer payment profile not found.")

    merchant_auth = _get_merchant_auth(creds.get("api_login_id"), creds.get("transaction_key"))
    request = api_contracts.getCustomerProfileRequest()
    request.merchantAuthentication = merchant_auth
    request.customerProfileId = profile.external_customer_id

    controller = getCustomerProfileController(request)
    if config.environment == "production":
        controller.setenvironment("https://api.authorize.net/xml/v1/request.api")
    else:
        controller.setenvironment("https://apitest.authorize.net/xml/v1/request.api")
    controller.execute()

    response = controller.getresponse()
    if response.messages.resultCode != "Ok":
        error_msg = response.messages.message[0].text if response.messages.message else "Unknown error"
        raise ValueError(f"Unable to sync customer payment profile: {error_msg}")

    hosted_profile = getattr(response, "profile", None)
    payment_profiles = list(getattr(hosted_profile, "paymentProfiles", []) or [])
    selected_profile = None
    for payment_profile in payment_profiles:
        if str(getattr(payment_profile, "defaultPaymentProfile", "false")).lower() == "true":
            selected_profile = payment_profile
            break
    if not selected_profile and payment_profiles:
        selected_profile = payment_profiles[0]

    if selected_profile:
        profile.external_payment_id = str(getattr(selected_profile, "customerPaymentProfileId", "") or "")
        profile.is_default = True
        _apply_masked_payment_details(profile, selected_profile)
        profile.status = "active"
    else:
        profile.external_payment_id = None
        profile.payment_method_type = None
        profile.payment_method_last4 = None
        profile.payment_method_brand = None
        profile.payment_method_exp_month = None
        profile.payment_method_exp_year = None
        profile.is_default = False
        profile.status = "pending"

    profile.updated_at = datetime.utcnow()
    await db.flush()
    return profile


async def create_hosted_profile_page_token(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_id: uuid.UUID,
    action: str = "manage",
    return_url: str | None = None,
) -> dict:
    """Create a hosted Accept Customer token so card entry happens on Authorize.net."""
    config = await _require_config(db, org_id)
    creds = config.credentials or {}
    profile = await _get_customer_profile(db, org_id, contact_id)
    if not profile or not profile.external_customer_id:
        profile = await create_customer(db, org_id, contact_id)

    merchant_auth = _get_merchant_auth(creds.get("api_login_id"), creds.get("transaction_key"))
    request = api_contracts.getHostedProfilePageRequest()
    request.merchantAuthentication = merchant_auth
    request.customerProfileId = profile.external_customer_id
    request.hostedProfileSettings = api_contracts.ArrayOfSetting()

    for name, value in _build_hosted_profile_settings(config.environment, return_url):
        setting = api_contracts.settingType()
        setting.settingName = name
        setting.settingValue = value
        request.hostedProfileSettings.setting.append(setting)

    controller = getHostedProfilePageController(request)
    if config.environment == "production":
        controller.setenvironment("https://api.authorize.net/xml/v1/request.api")
    else:
        controller.setenvironment("https://apitest.authorize.net/xml/v1/request.api")
    controller.execute()

    response = controller.getresponse()
    if response.messages.resultCode != "Ok":
        error_msg = _extract_authnet_error(response)
        raise ValueError(f"Unable to create hosted profile page token: {error_msg}")

    action_paths = {
        "manage": "customer/manage",
        "add_payment": "customer/addPayment",
        "edit_payment": "customer/editPayment",
    }
    base_url = "https://accept.authorize.net" if config.environment == "production" else "https://test.authorize.net"

    return {
        "token": str(response.token),
        "url": f"{base_url}/{action_paths.get(action, 'customer/manage')}",
        "customer_profile_id": profile.external_customer_id,
        "environment": config.environment,
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
        error_msg = ""
        error_code = ""
        if response.messages.message:
            error_msg = str(response.messages.message[0].text or "")
            error_code = str(getattr(response.messages.message[0], "code", "") or "")

        # E00039 = duplicate profile — reuse the existing one
        if error_code == "E00039" or "duplicate" in error_msg.lower():
            # Try to get the ID from the response first
            existing_id = getattr(response, "customerProfileId", None)
            if not existing_id:
                # Parse it from the error message — Authorize.net often includes it like "ID 12345"
                import re
                id_match = re.search(r'ID\s+(\d+)', error_msg)
                if id_match:
                    existing_id = id_match.group(1)
            if not existing_id:
                # Last resort: look up by email using getCustomerProfile by merchantCustomerId
                # The merchantCustomerId was set to str(contact_id)[:20]
                try:
                    from authorizenet.apicontrollers import getCustomerProfileController as getProfileCtrl
                    lookup_req = api_contracts.getCustomerProfileRequest()
                    lookup_req.merchantAuthentication = merchant_auth
                    lookup_req.merchantCustomerId = str(contact_id)[:20]
                    lookup_ctrl = getProfileCtrl(lookup_req)
                    if config.environment == "production":
                        lookup_ctrl.setenvironment("https://api.authorize.net/xml/v1/request.api")
                    else:
                        lookup_ctrl.setenvironment("https://apitest.authorize.net/xml/v1/request.api")
                    lookup_ctrl.execute()
                    lookup_resp = lookup_ctrl.getresponse()
                    if hasattr(lookup_resp, "profile") and lookup_resp.profile:
                        existing_id = str(lookup_resp.profile.customerProfileId)
                except Exception as lookup_err:
                    logger.warning(f"Failed to look up existing CIM profile: {lookup_err}")

            if existing_id:
                customer_profile_id = str(existing_id)
                logger.info(f"Reusing existing CIM profile {customer_profile_id} for contact {contact_id}")
            else:
                logger.warning(f"Duplicate CIM profile for contact {contact_id} but could not resolve ID")
                raise ValueError(f"Duplicate profile at Authorize.net but could not resolve. Contact support.")
        else:
            raise ValueError(f"Failed to create CIM profile: {error_msg or 'Unknown error'}")
    else:
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


async def add_bank_account_profile(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_id: uuid.UUID,
    routing_number: str,
    account_number: str,
    name_on_account: str,
    account_type: str = "checking",  # checking | savings | businessChecking
    echeck_type: str = "WEB",  # WEB | PPD | CCD
) -> CustomerPaymentProfile:
    """Add a bank account (ACH/eCheck) payment profile to an existing CIM customer."""
    config = await _require_config(db, org_id)
    creds = config.credentials or {}

    profile = await _get_customer_profile(db, org_id, contact_id)
    if not profile or not profile.external_customer_id:
        raise ValueError("Customer profile not found. Create customer first.")

    merchant_auth = _get_merchant_auth(creds.get("api_login_id"), creds.get("transaction_key"))

    # Build bank account payment profile
    bank_account = api_contracts.bankAccountType()
    bank_account.accountType = account_type
    bank_account.routingNumber = routing_number
    bank_account.accountNumber = account_number
    bank_account.nameOnAccount = name_on_account
    bank_account.echeckType = echeck_type

    payment = api_contracts.paymentType()
    payment.bankAccount = bank_account

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
        raise ValueError(f"Failed to create bank account profile: {error_msg}")

    payment_profile_id = str(response.customerPaymentProfileId)

    # Update profile with bank account details
    profile.external_payment_id = payment_profile_id
    profile.payment_method_type = "bank_account"
    profile.payment_method_last4 = account_number[-4:]
    profile.payment_method_brand = "ach"
    profile.payment_method_exp_month = None
    profile.payment_method_exp_year = None
    profile.is_default = True
    profile.updated_at = datetime.utcnow()

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
            rc = str(tr.responseCode)
            if rc == "1":
                status = "succeeded"
            elif rc == "4":
                status = "pending"  # held for review
            else:
                status = "failed"
                failure_code, failure_message = _extract_transaction_failure(tr)
    else:
        failure_message = _extract_authnet_error(response)

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
        description=f"Authorize.net transaction {external_id}.{(' ' + failure_message) if status == 'failed' and failure_message else ''}".strip(),
        performed_at=datetime.utcnow(),
    )
    db.add(activity)
    await db.flush()

    # Auto-generate invoice and email receipt for successful charges
    if status == "succeeded":
        from app.services.invoice_service import create_invoice_for_payment
        try:
            await create_invoice_for_payment(
                db, payment, description=description,
            )
        except Exception as e:
            logger.error(f"Failed to create invoice for payment {payment.id}: {e}")
            # Create a follow-up task so the missing invoice is never silently lost
            task = Task(
                organization_id=org_id,
                contact_id=contact_id,
                title=f"Invoice missing for ${amount:.2f} charge",
                description=f"Payment {payment.id} succeeded but invoice generation failed: {e}",
                type="follow_up",
                priority="high",
                status="pending",
            )
            db.add(task)

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

    # Deduplicate: skip if this transaction was already recorded (e.g. by charge_customer)
    existing = await db.execute(
        select(Payment).where(
            Payment.organization_id == org_id,
            Payment.external_payment_id == trans_id,
        )
    )
    if existing.scalar_one_or_none():
        logger.info(f"AuthNet payment_success: transaction {trans_id} already recorded, skipping")
        return

    # Enrich payment method details from customer profile
    pm_type = None
    pm_last4 = None
    if profile:
        pm_type = profile.payment_method_type
        pm_last4 = profile.payment_method_last4

    # Create payment record
    payment = Payment(
        organization_id=org_id,
        contact_id=contact_id,
        provider_config_id=config.id,
        external_payment_id=trans_id,
        status="succeeded",
        amount=amount,
        currency="usd",
        payment_method_type=pm_type,
        payment_method_last4=pm_last4,
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

    # Auto-generate invoice and email receipt
    from app.services.invoice_service import create_invoice_for_payment
    try:
        await create_invoice_for_payment(
            db, payment, description=f"Payment via Authorize.net (#{trans_id})",
        )
    except Exception as e:
        logger.error(f"Webhook: failed to create invoice for payment {payment.id}: {e}")
        task = Task(
            organization_id=org_id,
            contact_id=contact_id,
            title=f"Invoice missing for ${amount:.2f} webhook payment",
            description=f"Payment {payment.id} succeeded but invoice generation failed: {e}",
            type="follow_up",
            priority="high",
            status="pending",
        )
        db.add(task)


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


def _build_hosted_profile_settings(environment: str, return_url: str | None) -> list[tuple[str, str]]:
    normalized_return_url = return_url or f"{settings.app_base_url.rstrip('/')}/billing"
    return [
        ("hostedProfileReturnUrl", normalized_return_url),
        ("hostedProfileReturnUrlText", "Return to LSRV CRM"),
        ("hostedProfilePageBorderVisible", "true"),
    ]


def _apply_masked_payment_details(profile: CustomerPaymentProfile, payment_profile: object) -> None:
    payment = getattr(payment_profile, "payment", None)
    credit_card = getattr(payment, "creditCard", None)
    bank_account = getattr(payment, "bankAccount", None)

    if credit_card:
        profile.payment_method_type = "card"
        card_number = str(getattr(credit_card, "cardNumber", "") or "")
        profile.payment_method_last4 = "".join(ch for ch in card_number if ch.isdigit())[-4:] or None
        card_type = str(getattr(credit_card, "cardType", "") or "").lower()
        profile.payment_method_brand = card_type or _infer_brand_from_masked(card_number)
        expiration = str(getattr(credit_card, "expirationDate", "") or "")
        _apply_expiration(profile, expiration)
        return

    if bank_account:
        profile.payment_method_type = "bank_account"
        account_number = str(getattr(bank_account, "accountNumber", "") or "")
        profile.payment_method_last4 = "".join(ch for ch in account_number if ch.isdigit())[-4:] or None
        profile.payment_method_brand = "ach"
        profile.payment_method_exp_month = None
        profile.payment_method_exp_year = None


def _apply_expiration(profile: CustomerPaymentProfile, expiration: str) -> None:
    try:
        parts = expiration.split("-")
        if len(parts) == 2:
            profile.payment_method_exp_year = int(parts[0])
            profile.payment_method_exp_month = int(parts[1])
            return
    except (TypeError, ValueError):
        pass

    profile.payment_method_exp_year = None
    profile.payment_method_exp_month = None


def _infer_brand_from_masked(card_number: str) -> str | None:
    if not card_number:
        return None
    first_digit = next((char for char in card_number if char.isdigit()), "")
    brand_map = {"4": "visa", "5": "mastercard", "3": "amex", "6": "discover"}
    return brand_map.get(first_digit) or None


def _extract_authnet_error(response: object) -> str:
    messages = getattr(response, "messages", None)
    message_list = getattr(messages, "message", None)
    if message_list:
        first_message = message_list[0]
        code = getattr(first_message, "code", None)
        text = getattr(first_message, "text", None)
        if code and text:
            return f"{code}: {text}"
        if text:
            return str(text)
        if code:
            return str(code)

    for attr in ("text", "errorText"):
        value = getattr(response, attr, None)
        if value:
            return str(value)

    return "Unknown error from Authorize.net"


def _extract_transaction_failure(transaction_response: object) -> tuple[str | None, str | None]:
    errors = getattr(transaction_response, "errors", None)
    error_list = getattr(errors, "error", None)
    if error_list:
        first_error = error_list[0]
        return (
            str(getattr(first_error, "errorCode", "") or "") or None,
            str(getattr(first_error, "errorText", "") or "") or None,
        )

    messages = getattr(transaction_response, "messages", None)
    message_list = getattr(messages, "message", None)
    if message_list:
        first_message = message_list[0]
        return (
            str(getattr(first_message, "code", "") or "") or None,
            str(getattr(first_message, "description", "") or "") or None,
        )

    response_code = str(getattr(transaction_response, "responseCode", "") or "") or None
    return (response_code, "Authorize.net declined the stored payment method.")


# ── Gateway Reconciliation ──────────────────────────


async def reconcile_transactions(
    db: AsyncSession,
    org_id: uuid.UUID,
    date_from: date,
    date_to: date,
) -> dict:
    """Pull transactions from Authorize.net and compare against local Payment records.

    Returns a reconciliation report with matched, mismatched, and missing records.
    Gateway is the source of truth — mismatches are auto-corrected.
    """
    config = await _require_config(db, org_id)
    creds = config.credentials or {}
    merchant_auth = _get_merchant_auth(creds.get("api_login_id"), creds.get("transaction_key"))
    env_url = (
        "https://api.authorize.net/xml/v1/request.api"
        if config.environment == "production"
        else "https://apitest.authorize.net/xml/v1/request.api"
    )

    gateway_transactions = {}

    # 1. Get settled batches in the date range
    batch_request = api_contracts.getSettledBatchListRequest()
    batch_request.merchantAuthentication = merchant_auth
    batch_request.firstSettlementDate = datetime.combine(date_from, datetime.min.time())
    batch_request.lastSettlementDate = datetime.combine(date_to, datetime.max.time())
    batch_request.includeStatistics = False

    batch_ctrl = getSettledBatchListController(batch_request)
    batch_ctrl.setenvironment(env_url)
    batch_ctrl.execute()
    batch_response = batch_ctrl.getresponse()

    batch_list = getattr(batch_response, "batchList", None)
    batches = getattr(batch_list, "batch", None) or [] if batch_list else []

    for batch in batches:
        batch_id = str(batch.batchId)
        # Get transactions in this batch
        txn_list_req = api_contracts.getTransactionListRequest()
        txn_list_req.merchantAuthentication = merchant_auth
        txn_list_req.batchId = batch_id
        txn_list_req.paging = api_contracts.Paging()
        txn_list_req.paging.limit = 1000
        txn_list_req.paging.offset = 1

        txn_ctrl = getTransactionListController(txn_list_req)
        txn_ctrl.setenvironment(env_url)
        txn_ctrl.execute()
        txn_response = txn_ctrl.getresponse()

        txn_list = getattr(txn_response, "transactions", None)
        txns = getattr(txn_list, "transaction", None) or [] if txn_list else []

        for txn in txns:
            trans_id = str(txn.transId)
            txn_status = str(getattr(txn, "transactionStatus", "")).lower()
            txn_amount = float(getattr(txn, "settleAmount", 0) or 0)

            # Map Authorize.net statuses to our status
            if txn_status in ("settledsuccessfully", "capturedpendingreview", "capturedpendingsettlement"):
                local_status = "succeeded"
            elif txn_status in ("declined", "error", "generalerror"):
                local_status = "failed"
            elif txn_status in ("voided", "refundsettledsuccessfully"):
                local_status = "refunded"
            else:
                local_status = "unknown"

            gateway_transactions[trans_id] = {
                "trans_id": trans_id,
                "amount": txn_amount,
                "gateway_status": txn_status,
                "mapped_status": local_status,
            }

    # 2. Also get unsettled transactions
    unsettled_req = api_contracts.getUnsettledTransactionListRequest()
    unsettled_req.merchantAuthentication = merchant_auth
    unsettled_req.paging = api_contracts.Paging()
    unsettled_req.paging.limit = 1000
    unsettled_req.paging.offset = 1

    unsettled_ctrl = getUnsettledTransactionListController(unsettled_req)
    unsettled_ctrl.setenvironment(env_url)
    unsettled_ctrl.execute()
    unsettled_response = unsettled_ctrl.getresponse()

    unsettled_list = getattr(unsettled_response, "transactions", None)
    unsettled_txns = getattr(unsettled_list, "transaction", None) or [] if unsettled_list else []

    for txn in unsettled_txns:
        trans_id = str(txn.transId)
        txn_status = str(getattr(txn, "transactionStatus", "")).lower()
        txn_amount = float(getattr(txn, "settleAmount", 0) or getattr(txn, "authAmount", 0) or 0)

        if txn_status in ("authorizedpendingcapture", "capturedpendingsettlement"):
            local_status = "succeeded"
        elif txn_status in ("declined", "error"):
            local_status = "failed"
        else:
            local_status = "pending"

        if trans_id not in gateway_transactions:
            gateway_transactions[trans_id] = {
                "trans_id": trans_id,
                "amount": txn_amount,
                "gateway_status": txn_status,
                "mapped_status": local_status,
            }

    # 3. Compare against local Payment records
    local_payments_result = await db.execute(
        select(Payment).where(
            Payment.organization_id == org_id,
            Payment.external_payment_id.isnot(None),
            Payment.external_payment_id != "",
            Payment.payment_date >= date_from,
            Payment.payment_date <= date_to,
        )
    )
    local_payments = {
        p.external_payment_id: p
        for p in local_payments_result.scalars().all()
    }

    matched = []
    mismatches = []
    missing_local = []
    missing_gateway = []
    corrections = 0

    # Check every gateway transaction against local records
    for trans_id, gw_txn in gateway_transactions.items():
        if trans_id in local_payments:
            local = local_payments[trans_id]
            if local.status == gw_txn["mapped_status"] or gw_txn["mapped_status"] == "unknown":
                matched.append({
                    "trans_id": trans_id,
                    "amount": gw_txn["amount"],
                    "status": local.status,
                })
            else:
                old_status = local.status
                # Gateway is source of truth — auto-correct
                local.status = gw_txn["mapped_status"]
                corrections += 1

                # Log the correction as an activity
                activity = Activity(
                    organization_id=org_id,
                    contact_id=local.contact_id,
                    type="payment_succeeded" if gw_txn["mapped_status"] == "succeeded" else "payment_failed",
                    subject=f"Payment status corrected: ${gw_txn['amount']:.2f}",
                    description=f"Reconciliation: changed from '{old_status}' to '{gw_txn['mapped_status']}' (gateway: {gw_txn['gateway_status']})",
                    performed_at=datetime.utcnow(),
                )
                db.add(activity)

                # If corrected to succeeded and no invoice exists, create one
                if gw_txn["mapped_status"] == "succeeded" and not local.invoice_id:
                    from app.services.invoice_service import create_invoice_for_payment
                    try:
                        await create_invoice_for_payment(
                            db, local, description=f"Payment reconciled (#{trans_id})",
                        )
                    except Exception as e:
                        logger.error(f"Reconciliation: invoice creation failed for {trans_id}: {e}")

                mismatches.append({
                    "trans_id": trans_id,
                    "amount": gw_txn["amount"],
                    "local_status": old_status,
                    "gateway_status": gw_txn["gateway_status"],
                    "corrected_to": gw_txn["mapped_status"],
                })
        else:
            missing_local.append({
                "trans_id": trans_id,
                "amount": gw_txn["amount"],
                "gateway_status": gw_txn["gateway_status"],
            })

    # Check for local payments not in gateway
    for trans_id, local in local_payments.items():
        if trans_id not in gateway_transactions:
            missing_gateway.append({
                "trans_id": trans_id,
                "amount": float(local.amount),
                "local_status": local.status,
                "contact_id": str(local.contact_id),
            })

    await db.flush()

    return {
        "date_from": str(date_from),
        "date_to": str(date_to),
        "total_gateway_transactions": len(gateway_transactions),
        "total_local_payments": len(local_payments),
        "matched": len(matched),
        "mismatches": mismatches,
        "missing_local": missing_local,
        "missing_gateway": missing_gateway,
        "corrections_applied": corrections,
        "reconciled_at": datetime.utcnow().isoformat(),
    }


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
