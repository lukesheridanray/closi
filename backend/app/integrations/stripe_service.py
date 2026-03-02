"""
Stripe integration service -- Connect OAuth, customer management,
subscriptions, one-time charges, and webhook processing.
"""

import logging
import uuid
from datetime import date, datetime

import stripe
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

# Configure Stripe SDK
stripe.api_key = settings.stripe_secret_key

# Your platform's Stripe Connect client ID (set in .env for OAuth)
STRIPE_CLIENT_ID = ""  # Set via env if using OAuth; we use account links instead


# ── Stripe Connect ──────────────────────────────────


async def create_connect_account(
    db: AsyncSession, org_id: uuid.UUID
) -> str:
    """Create a Stripe Connect Express account and return the onboarding URL."""
    org = await _get_org(db, org_id)

    if org.stripe_account_id:
        # Account already exists, just create a new onboarding link
        account_link = stripe.AccountLink.create(
            account=org.stripe_account_id,
            refresh_url=f"{_frontend_url()}/settings/payments?stripe=refresh",
            return_url=f"{_frontend_url()}/settings/payments?stripe=complete",
            type="account_onboarding",
        )
        return account_link.url

    # Create a new Express account
    account = stripe.Account.create(
        type="express",
        country="US",
        email=org.email,
        capabilities={
            "card_payments": {"requested": True},
            "transfers": {"requested": True},
        },
        business_profile={
            "name": org.name,
        },
        metadata={
            "lsrv_org_id": str(org_id),
        },
    )

    # Store the account ID
    org.stripe_account_id = account.id
    org.stripe_connected = False
    org.stripe_onboarding_complete = False
    org.updated_at = datetime.utcnow()
    await db.flush()

    # Create the onboarding link
    account_link = stripe.AccountLink.create(
        account=account.id,
        refresh_url=f"{_frontend_url()}/settings/payments?stripe=refresh",
        return_url=f"{_frontend_url()}/settings/payments?stripe=complete",
        type="account_onboarding",
    )
    return account_link.url


async def complete_onboarding(
    db: AsyncSession, org_id: uuid.UUID
) -> dict:
    """Check if Stripe onboarding is complete and update org status."""
    org = await _get_org(db, org_id)

    if not org.stripe_account_id:
        raise ValueError("No Stripe account connected.")

    account = stripe.Account.retrieve(org.stripe_account_id)

    charges_enabled = account.charges_enabled
    details_submitted = account.details_submitted

    org.stripe_connected = charges_enabled
    org.stripe_onboarding_complete = details_submitted
    org.updated_at = datetime.utcnow()
    await db.flush()

    return {
        "account_id": org.stripe_account_id,
        "charges_enabled": charges_enabled,
        "details_submitted": details_submitted,
        "connected": charges_enabled,
        "onboarding_complete": details_submitted,
        "business_name": account.business_profile.name if account.business_profile else org.name,
    }


async def get_stripe_status(
    db: AsyncSession, org_id: uuid.UUID
) -> dict:
    """Get current Stripe connection status."""
    org = await _get_org(db, org_id)

    if not org.stripe_account_id:
        return {
            "connected": False,
            "account_id": None,
            "onboarding_complete": False,
            "charges_enabled": False,
        }

    try:
        account = stripe.Account.retrieve(org.stripe_account_id)
        connected = account.charges_enabled
        onboarding_complete = account.details_submitted

        # Keep org in sync
        if org.stripe_connected != connected or org.stripe_onboarding_complete != onboarding_complete:
            org.stripe_connected = connected
            org.stripe_onboarding_complete = onboarding_complete
            org.updated_at = datetime.utcnow()
            await db.flush()

        return {
            "connected": connected,
            "account_id": org.stripe_account_id,
            "onboarding_complete": onboarding_complete,
            "charges_enabled": connected,
            "business_name": account.business_profile.name if account.business_profile else org.name,
            "environment": "production" if not settings.stripe_secret_key.startswith("sk_test") else "sandbox",
        }
    except stripe.StripeError as e:
        logger.error(f"Failed to retrieve Stripe account: {e}")
        return {
            "connected": org.stripe_connected,
            "account_id": org.stripe_account_id,
            "onboarding_complete": org.stripe_onboarding_complete,
            "charges_enabled": org.stripe_connected,
            "error": str(e),
        }


async def disconnect_stripe(
    db: AsyncSession, org_id: uuid.UUID
) -> None:
    """Remove Stripe connection from the organization."""
    org = await _get_org(db, org_id)
    org.stripe_account_id = None
    org.stripe_connected = False
    org.stripe_onboarding_complete = False
    org.updated_at = datetime.utcnow()
    await db.flush()


async def create_dashboard_login_link(
    db: AsyncSession, org_id: uuid.UUID
) -> str:
    """Generate a Stripe Express dashboard login link."""
    org = await _get_org(db, org_id)
    if not org.stripe_account_id:
        raise ValueError("No Stripe account connected.")

    link = stripe.Account.create_login_link(org.stripe_account_id)
    return link.url


# ── Customer Management ─────────────────────────────


async def create_customer(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_id: uuid.UUID,
) -> CustomerPaymentProfile:
    """Create a Stripe customer for a contact and store the profile."""
    org = await _get_org(db, org_id)
    _require_connected(org)

    contact = await _get_contact(db, org_id, contact_id)

    # Check if customer profile already exists
    existing = await _get_customer_profile(db, org_id, contact_id)
    if existing and existing.external_customer_id:
        return existing

    # Get or create provider config
    provider_config = await _get_or_create_provider_config(db, org_id)

    # Create Stripe customer on the connected account
    customer = stripe.Customer.create(
        email=contact.email,
        name=f"{contact.first_name} {contact.last_name}",
        phone=contact.phone,
        metadata={
            "lsrv_contact_id": str(contact_id),
            "lsrv_org_id": str(org_id),
        },
        stripe_account=org.stripe_account_id,
    )

    # Store the customer payment profile
    profile = CustomerPaymentProfile(
        organization_id=org_id,
        contact_id=contact_id,
        provider_config_id=provider_config.id,
        external_customer_id=customer.id,
        status="active",
    )
    db.add(profile)
    await db.flush()

    logger.info(f"Created Stripe customer {customer.id} for contact {contact_id}")
    return profile


async def create_setup_intent(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_id: uuid.UUID,
) -> dict:
    """Create a Stripe SetupIntent for collecting payment method."""
    org = await _get_org(db, org_id)
    _require_connected(org)

    # Ensure customer exists
    profile = await _get_customer_profile(db, org_id, contact_id)
    if not profile or not profile.external_customer_id:
        profile = await create_customer(db, org_id, contact_id)

    setup_intent = stripe.SetupIntent.create(
        customer=profile.external_customer_id,
        payment_method_types=["card"],
        metadata={
            "lsrv_contact_id": str(contact_id),
            "lsrv_org_id": str(org_id),
        },
        stripe_account=org.stripe_account_id,
    )

    return {
        "client_secret": setup_intent.client_secret,
        "setup_intent_id": setup_intent.id,
        "customer_id": profile.external_customer_id,
        "stripe_account_id": org.stripe_account_id,
    }


async def attach_payment_method(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_id: uuid.UUID,
    payment_method_id: str,
) -> CustomerPaymentProfile:
    """Attach a payment method to a customer and update the profile."""
    org = await _get_org(db, org_id)
    _require_connected(org)

    profile = await _get_customer_profile(db, org_id, contact_id)
    if not profile:
        raise ValueError("Customer payment profile not found.")

    # Retrieve the payment method to get card details
    pm = stripe.PaymentMethod.retrieve(
        payment_method_id,
        stripe_account=org.stripe_account_id,
    )

    # Set as default payment method
    stripe.Customer.modify(
        profile.external_customer_id,
        invoice_settings={"default_payment_method": payment_method_id},
        stripe_account=org.stripe_account_id,
    )

    # Update profile with payment method details
    profile.external_payment_id = payment_method_id
    if pm.card:
        profile.payment_method_type = "card"
        profile.payment_method_last4 = pm.card.last4
        profile.payment_method_brand = pm.card.brand
        profile.payment_method_exp_month = pm.card.exp_month
        profile.payment_method_exp_year = pm.card.exp_year
    profile.is_default = True
    profile.updated_at = datetime.utcnow()
    await db.flush()

    return profile


# ── Subscription Billing ────────────────────────────


async def create_subscription(
    db: AsyncSession,
    org_id: uuid.UUID,
    contract_id: uuid.UUID,
) -> Subscription:
    """Create a Stripe subscription for a contract's recurring billing."""
    org = await _get_org(db, org_id)
    _require_connected(org)

    contract = await _get_contract(db, org_id, contract_id)
    if contract.monthly_amount <= 0:
        raise ValueError("Contract has no recurring amount.")

    contact_id = contract.contact_id
    profile = await _get_customer_profile(db, org_id, contact_id)
    if not profile or not profile.external_customer_id:
        raise ValueError("Customer has no payment profile. Set up payment method first.")
    if not profile.external_payment_id:
        raise ValueError("Customer has no payment method on file.")

    provider_config = await _get_or_create_provider_config(db, org_id)

    # Create or reuse a Stripe Product for this org
    product = _get_or_create_product(org)

    # Create a Stripe Price for the monthly amount
    price = stripe.Price.create(
        product=product.id,
        unit_amount=int(float(contract.monthly_amount) * 100),  # cents
        currency="usd",
        recurring={"interval": "month"},
        metadata={
            "lsrv_contract_id": str(contract_id),
            "lsrv_org_id": str(org_id),
        },
        stripe_account=org.stripe_account_id,
    )

    # Create the Stripe Subscription
    stripe_sub = stripe.Subscription.create(
        customer=profile.external_customer_id,
        items=[{"price": price.id}],
        default_payment_method=profile.external_payment_id,
        metadata={
            "lsrv_contract_id": str(contract_id),
            "lsrv_org_id": str(org_id),
            "lsrv_contact_id": str(contact_id),
        },
        stripe_account=org.stripe_account_id,
    )

    # Create local subscription record
    sub = Subscription(
        organization_id=org_id,
        contract_id=contract_id,
        contact_id=contact_id,
        provider_config_id=provider_config.id,
        customer_payment_profile_id=profile.id,
        external_subscription_id=stripe_sub.id,
        status="active",
        amount=float(contract.monthly_amount),
        currency="usd",
        billing_interval="monthly",
        billing_interval_count=1,
        current_period_start=_ts_to_date(stripe_sub.current_period_start),
        current_period_end=_ts_to_date(stripe_sub.current_period_end),
        next_billing_date=_ts_to_date(stripe_sub.current_period_end),
    )
    db.add(sub)

    # Update contract status to active
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
        description=f"Stripe subscription {stripe_sub.id} created for contract {contract.title}",
        performed_at=datetime.utcnow(),
    )
    db.add(activity)
    await db.flush()

    logger.info(f"Created Stripe subscription {stripe_sub.id} for contract {contract_id}")
    return sub


async def create_one_time_charge(
    db: AsyncSession,
    org_id: uuid.UUID,
    contract_id: uuid.UUID,
) -> Payment:
    """Create a one-time charge for equipment total on a contract."""
    org = await _get_org(db, org_id)
    _require_connected(org)

    contract = await _get_contract(db, org_id, contract_id)
    if contract.equipment_total <= 0:
        raise ValueError("Contract has no equipment charge.")

    contact_id = contract.contact_id
    profile = await _get_customer_profile(db, org_id, contact_id)
    if not profile or not profile.external_payment_id:
        raise ValueError("Customer has no payment method on file.")

    provider_config = await _get_or_create_provider_config(db, org_id)

    # Create a PaymentIntent
    payment_intent = stripe.PaymentIntent.create(
        amount=int(float(contract.equipment_total) * 100),
        currency="usd",
        customer=profile.external_customer_id,
        payment_method=profile.external_payment_id,
        confirm=True,
        off_session=True,
        metadata={
            "lsrv_contract_id": str(contract_id),
            "lsrv_org_id": str(org_id),
            "lsrv_contact_id": str(contact_id),
            "charge_type": "equipment",
        },
        stripe_account=org.stripe_account_id,
    )

    # Create local payment record
    payment = Payment(
        organization_id=org_id,
        contact_id=contact_id,
        contract_id=contract_id,
        provider_config_id=provider_config.id,
        external_payment_id=payment_intent.id,
        status="succeeded" if payment_intent.status == "succeeded" else "pending",
        amount=float(contract.equipment_total),
        currency="usd",
        payment_method_type=profile.payment_method_type,
        payment_method_last4=profile.payment_method_last4,
        payment_date=date.today(),
    )
    db.add(payment)
    await db.flush()

    logger.info(f"Created one-time charge {payment_intent.id} for ${contract.equipment_total}")
    return payment


# ── Webhook Processing ──────────────────────────────


async def process_webhook_event(
    db: AsyncSession,
    payload: bytes,
    sig_header: str,
) -> dict:
    """Verify and process a Stripe webhook event."""
    # Verify signature
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except stripe.SignatureVerificationError:
        raise ValueError("Invalid webhook signature.")
    except ValueError:
        raise ValueError("Invalid webhook payload.")

    event_type = event.type
    event_data = event.data.object

    # Determine org from the connected account
    account_id = event.get("account")  # Connected account ID
    org = None
    if account_id:
        result = await db.execute(
            select(Organization).where(Organization.stripe_account_id == account_id)
        )
        org = result.scalar_one_or_none()

    if not org:
        # Try to find org from metadata
        metadata = getattr(event_data, "metadata", {}) or {}
        lsrv_org_id = metadata.get("lsrv_org_id")
        if lsrv_org_id:
            result = await db.execute(
                select(Organization).where(Organization.id == uuid.UUID(lsrv_org_id))
            )
            org = result.scalar_one_or_none()

    if not org:
        logger.warning(f"Could not determine org for webhook event {event.id}")
        return {"status": "ignored", "reason": "unknown_organization"}

    # Log the webhook event
    provider_config = await _get_provider_config(db, org.id)
    webhook_log = PaymentWebhookLog(
        organization_id=org.id,
        provider_config_id=provider_config.id if provider_config else org.id,
        external_event_id=event.id,
        event_type=event_type,
        raw_payload=event.to_dict(),
        processing_status="received",
        received_at=datetime.utcnow(),
    )
    db.add(webhook_log)
    await db.flush()

    # Process by event type
    result = {"status": "processed", "event_type": event_type}
    try:
        if event_type == "invoice.payment_succeeded":
            await _handle_payment_succeeded(db, org, event_data)
        elif event_type == "invoice.payment_failed":
            await _handle_payment_failed(db, org, event_data)
        elif event_type == "customer.subscription.deleted":
            await _handle_subscription_deleted(db, org, event_data)
        elif event_type == "customer.subscription.updated":
            await _handle_subscription_updated(db, org, event_data)
        elif event_type == "charge.refunded":
            await _handle_charge_refunded(db, org, event_data)
        else:
            result["status"] = "ignored"
            result["reason"] = "unhandled_event_type"

        webhook_log.processing_status = "processed"
        webhook_log.processed_at = datetime.utcnow()
    except Exception as e:
        logger.error(f"Error processing webhook {event.id}: {e}")
        webhook_log.processing_status = "error"
        webhook_log.error_message = str(e)
        webhook_log.processed_at = datetime.utcnow()
        result["status"] = "error"
        result["error"] = str(e)

    await db.flush()
    return result


# ── Webhook Event Handlers ──────────────────────────


async def _handle_payment_succeeded(
    db: AsyncSession, org: Organization, invoice_data
) -> None:
    """Handle invoice.payment_succeeded -- create payment record, update invoice."""
    org_id = org.id
    provider_config = await _get_provider_config(db, org_id)
    metadata = getattr(invoice_data, "metadata", {}) or {}

    # Find the subscription
    stripe_sub_id = getattr(invoice_data, "subscription", None)
    sub = None
    if stripe_sub_id:
        result = await db.execute(
            select(Subscription).where(
                Subscription.organization_id == org_id,
                Subscription.external_subscription_id == stripe_sub_id,
            )
        )
        sub = result.scalar_one_or_none()

    # Find the contact
    contact_id = None
    contract_id = None
    if sub:
        contact_id = sub.contact_id
        contract_id = sub.contract_id
    else:
        lsrv_contact_id = metadata.get("lsrv_contact_id")
        if lsrv_contact_id:
            contact_id = uuid.UUID(lsrv_contact_id)
        lsrv_contract_id = metadata.get("lsrv_contract_id")
        if lsrv_contract_id:
            contract_id = uuid.UUID(lsrv_contract_id)

    if not contact_id:
        logger.warning("payment_succeeded: could not determine contact_id")
        return

    amount_paid = getattr(invoice_data, "amount_paid", 0) / 100.0
    period_start = _ts_to_date(getattr(invoice_data, "period_start", None))
    period_end = _ts_to_date(getattr(invoice_data, "period_end", None))

    # Create payment record
    payment = Payment(
        organization_id=org_id,
        contact_id=contact_id,
        contract_id=contract_id,
        subscription_id=sub.id if sub else None,
        provider_config_id=provider_config.id if provider_config else None,
        external_payment_id=getattr(invoice_data, "payment_intent", None) or getattr(invoice_data, "id", ""),
        status="succeeded",
        amount=amount_paid,
        currency=getattr(invoice_data, "currency", "usd"),
        payment_date=date.today(),
        period_start=period_start,
        period_end=period_end,
    )
    db.add(payment)

    # Update subscription
    if sub:
        sub.failed_payment_count = 0
        sub.last_payment_at = datetime.utcnow()
        if period_start:
            sub.current_period_start = period_start
        if period_end:
            sub.current_period_end = period_end
            sub.next_billing_date = period_end
        sub.status = "active"
        sub.updated_at = datetime.utcnow()

    # Find and update matching invoice
    stripe_invoice_id = getattr(invoice_data, "id", None)
    if stripe_invoice_id:
        result = await db.execute(
            select(Invoice).where(
                Invoice.organization_id == org_id,
                Invoice.external_invoice_id == stripe_invoice_id,
            )
        )
        local_invoice = result.scalar_one_or_none()
        if local_invoice:
            local_invoice.status = "paid"
            local_invoice.amount_paid = amount_paid
            local_invoice.amount_due = 0
            local_invoice.paid_at = datetime.utcnow()
            local_invoice.updated_at = datetime.utcnow()
            payment.invoice_id = local_invoice.id

    # Log activity
    activity = Activity(
        organization_id=org_id,
        contact_id=contact_id,
        type="payment_succeeded",
        subject=f"Payment received: ${amount_paid:.2f}",
        description=f"Stripe payment succeeded for {getattr(invoice_data, 'id', 'N/A')}",
        performed_at=datetime.utcnow(),
    )
    db.add(activity)
    await db.flush()


async def _handle_payment_failed(
    db: AsyncSession, org: Organization, invoice_data
) -> None:
    """Handle invoice.payment_failed -- create failed payment, create task, notify."""
    org_id = org.id
    provider_config = await _get_provider_config(db, org_id)
    metadata = getattr(invoice_data, "metadata", {}) or {}

    stripe_sub_id = getattr(invoice_data, "subscription", None)
    sub = None
    if stripe_sub_id:
        result = await db.execute(
            select(Subscription).where(
                Subscription.organization_id == org_id,
                Subscription.external_subscription_id == stripe_sub_id,
            )
        )
        sub = result.scalar_one_or_none()

    contact_id = None
    contract_id = None
    if sub:
        contact_id = sub.contact_id
        contract_id = sub.contract_id
    else:
        lsrv_contact_id = metadata.get("lsrv_contact_id")
        if lsrv_contact_id:
            contact_id = uuid.UUID(lsrv_contact_id)
        lsrv_contract_id = metadata.get("lsrv_contract_id")
        if lsrv_contract_id:
            contract_id = uuid.UUID(lsrv_contract_id)

    if not contact_id:
        logger.warning("payment_failed: could not determine contact_id")
        return

    amount = getattr(invoice_data, "amount_due", 0) / 100.0
    attempt_count = getattr(invoice_data, "attempt_count", 1)

    # Get failure details from the charge
    charge_id = getattr(invoice_data, "charge", None)
    failure_code = None
    failure_message = None
    if charge_id:
        try:
            charge = stripe.Charge.retrieve(charge_id, stripe_account=org.stripe_account_id)
            failure_code = charge.failure_code
            failure_message = charge.failure_message
        except stripe.StripeError:
            pass

    # Create failed payment record
    payment = Payment(
        organization_id=org_id,
        contact_id=contact_id,
        contract_id=contract_id,
        subscription_id=sub.id if sub else None,
        provider_config_id=provider_config.id if provider_config else None,
        external_payment_id=getattr(invoice_data, "payment_intent", None) or "",
        status="failed",
        amount=amount,
        currency=getattr(invoice_data, "currency", "usd"),
        payment_date=date.today(),
        failure_code=failure_code,
        failure_message=failure_message,
        attempt_number=attempt_count,
    )
    db.add(payment)

    # Update subscription
    if sub:
        sub.failed_payment_count = (sub.failed_payment_count or 0) + 1
        sub.updated_at = datetime.utcnow()
        if sub.failed_payment_count >= 3:
            sub.status = "past_due"

    # Create a task for the admin/owner
    contact = await _get_contact(db, org_id, contact_id)
    contact_name = f"{contact.first_name} {contact.last_name}" if contact else "Unknown"

    priority = "high" if attempt_count >= 3 else "medium"
    task = Task(
        organization_id=org_id,
        contact_id=contact_id,
        title=f"Failed payment: {contact_name} - ${amount:.2f}",
        description=(
            f"Payment of ${amount:.2f} failed (attempt #{attempt_count}). "
            f"Failure: {failure_message or 'Unknown'}. "
            f"Please contact the customer to update their payment method."
        ),
        priority=priority,
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
        subject=f"Payment failed: ${amount:.2f} (attempt #{attempt_count})",
        description=f"Failure: {failure_message or 'Unknown'}. Code: {failure_code or 'N/A'}",
        performed_at=datetime.utcnow(),
    )
    db.add(activity)

    # Send failure notification email to customer
    if contact and contact.email:
        from app.services.notification_service import send_email
        await send_email(
            to=contact.email,
            subject=f"Payment failed - Action required",
            html_body=f"""
            <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #6C63FF; padding: 24px; border-radius: 8px 8px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 20px;">{org.name}</h1>
                </div>
                <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                    <h2 style="color: #dc2626; margin-top: 0;">Payment Failed</h2>
                    <p>Your payment of <strong>${amount:.2f}</strong> could not be processed.</p>
                    <p>Please update your payment method or contact us to resolve this issue.</p>
                </div>
            </div>
            """,
        )

    await db.flush()


async def _handle_subscription_deleted(
    db: AsyncSession, org: Organization, sub_data
) -> None:
    """Handle customer.subscription.deleted -- cancel subscription and contract."""
    org_id = org.id
    stripe_sub_id = sub_data.id

    result = await db.execute(
        select(Subscription).where(
            Subscription.organization_id == org_id,
            Subscription.external_subscription_id == stripe_sub_id,
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        logger.warning(f"subscription_deleted: no local sub for {stripe_sub_id}")
        return

    sub.status = "cancelled"
    sub.cancelled_at = datetime.utcnow()
    sub.cancellation_reason = "Cancelled in Stripe"
    sub.updated_at = datetime.utcnow()

    # Cancel the contract too
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
            contract.cancellation_reason = "Stripe subscription cancelled"
            contract.updated_at = datetime.utcnow()

    # Log activity
    activity = Activity(
        organization_id=org_id,
        contact_id=sub.contact_id,
        type="subscription_cancelled",
        subject="Subscription cancelled",
        description=f"Stripe subscription {stripe_sub_id} was cancelled",
        performed_at=datetime.utcnow(),
    )
    db.add(activity)
    await db.flush()


async def _handle_subscription_updated(
    db: AsyncSession, org: Organization, sub_data
) -> None:
    """Handle customer.subscription.updated -- sync status changes."""
    org_id = org.id
    stripe_sub_id = sub_data.id

    result = await db.execute(
        select(Subscription).where(
            Subscription.organization_id == org_id,
            Subscription.external_subscription_id == stripe_sub_id,
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return

    # Map Stripe status to our status
    stripe_status = sub_data.status
    status_map = {
        "active": "active",
        "past_due": "past_due",
        "canceled": "cancelled",
        "unpaid": "past_due",
        "incomplete": "active",
        "incomplete_expired": "expired",
        "trialing": "active",
        "paused": "paused",
    }
    new_status = status_map.get(stripe_status, sub.status)

    sub.status = new_status
    if hasattr(sub_data, "current_period_start") and sub_data.current_period_start:
        sub.current_period_start = _ts_to_date(sub_data.current_period_start)
    if hasattr(sub_data, "current_period_end") and sub_data.current_period_end:
        sub.current_period_end = _ts_to_date(sub_data.current_period_end)
        sub.next_billing_date = _ts_to_date(sub_data.current_period_end)
    sub.updated_at = datetime.utcnow()
    await db.flush()


async def _handle_charge_refunded(
    db: AsyncSession, org: Organization, charge_data
) -> None:
    """Handle charge.refunded -- create refund payment record."""
    org_id = org.id
    provider_config = await _get_provider_config(db, org_id)
    metadata = getattr(charge_data, "metadata", {}) or {}

    contact_id = None
    contract_id = None
    lsrv_contact_id = metadata.get("lsrv_contact_id")
    if lsrv_contact_id:
        contact_id = uuid.UUID(lsrv_contact_id)
    lsrv_contract_id = metadata.get("lsrv_contract_id")
    if lsrv_contract_id:
        contract_id = uuid.UUID(lsrv_contract_id)

    # Try to find contact from the Stripe customer
    if not contact_id:
        stripe_customer_id = getattr(charge_data, "customer", None)
        if stripe_customer_id:
            result = await db.execute(
                select(CustomerPaymentProfile).where(
                    CustomerPaymentProfile.organization_id == org_id,
                    CustomerPaymentProfile.external_customer_id == stripe_customer_id,
                )
            )
            profile = result.scalar_one_or_none()
            if profile:
                contact_id = profile.contact_id

    if not contact_id:
        logger.warning("charge_refunded: could not determine contact_id")
        return

    amount_refunded = getattr(charge_data, "amount_refunded", 0) / 100.0

    payment = Payment(
        organization_id=org_id,
        contact_id=contact_id,
        contract_id=contract_id,
        provider_config_id=provider_config.id if provider_config else None,
        external_payment_id=charge_data.id,
        status="refunded",
        amount=amount_refunded,
        amount_refunded=amount_refunded,
        currency=getattr(charge_data, "currency", "usd"),
        payment_date=date.today(),
    )
    db.add(payment)

    # Log activity
    activity = Activity(
        organization_id=org_id,
        contact_id=contact_id,
        type="payment_refunded",
        subject=f"Refund issued: ${amount_refunded:.2f}",
        description=f"Stripe charge {charge_data.id} was refunded",
        performed_at=datetime.utcnow(),
    )
    db.add(activity)
    await db.flush()


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


async def _get_org(db: AsyncSession, org_id: uuid.UUID) -> Organization:
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise ValueError("Organization not found.")
    return org


def _require_connected(org: Organization) -> None:
    if not org.stripe_account_id or not org.stripe_connected:
        raise ValueError("Stripe is not connected. Please connect your Stripe account first.")


async def _get_contact(db: AsyncSession, org_id: uuid.UUID, contact_id: uuid.UUID) -> Contact:
    result = await db.execute(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.organization_id == org_id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise ValueError("Contact not found.")
    return contact


async def _get_contract(db: AsyncSession, org_id: uuid.UUID, contract_id: uuid.UUID) -> Contract:
    result = await db.execute(
        select(Contract).where(
            Contract.id == contract_id,
            Contract.organization_id == org_id,
        )
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise ValueError("Contract not found.")
    return contract


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


async def _get_or_create_provider_config(
    db: AsyncSession, org_id: uuid.UUID
) -> PaymentProviderConfig:
    result = await db.execute(
        select(PaymentProviderConfig).where(
            PaymentProviderConfig.organization_id == org_id,
            PaymentProviderConfig.provider_type == "stripe",
        )
    )
    config = result.scalar_one_or_none()
    if config:
        return config

    config = PaymentProviderConfig(
        organization_id=org_id,
        provider_type="stripe",
        display_name="Stripe",
        is_active=True,
        environment="sandbox" if settings.stripe_secret_key.startswith("sk_test") else "production",
    )
    db.add(config)
    await db.flush()
    return config


async def _get_provider_config(
    db: AsyncSession, org_id: uuid.UUID
) -> PaymentProviderConfig | None:
    result = await db.execute(
        select(PaymentProviderConfig).where(
            PaymentProviderConfig.organization_id == org_id,
            PaymentProviderConfig.provider_type == "stripe",
        )
    )
    return result.scalar_one_or_none()


def _get_or_create_product(org: Organization) -> stripe.Product:
    """Get or create a Stripe Product for the org's monitoring service."""
    # Search for existing product
    products = stripe.Product.list(
        limit=1,
        stripe_account=org.stripe_account_id,
        active=True,
    )
    if products.data:
        return products.data[0]

    # Create new product
    return stripe.Product.create(
        name=f"{org.name} - Monitoring Service",
        metadata={"lsrv_org_id": str(org.id)},
        stripe_account=org.stripe_account_id,
    )


def _ts_to_date(timestamp) -> date | None:
    """Convert a Unix timestamp to a date."""
    if not timestamp:
        return None
    return datetime.utcfromtimestamp(timestamp).date()


def _frontend_url() -> str:
    """Get the frontend URL from CORS origins."""
    origins = settings.cors_origins_list
    for origin in origins:
        if origin != "*":
            return origin
    return "http://localhost:5173"
