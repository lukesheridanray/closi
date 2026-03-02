"""
Stripe integration tests -- Full flow from connect to recurring payment.

Uses unittest.mock to mock Stripe API calls, testing our service logic
without requiring actual Stripe credentials.
"""

import json
import uuid
import time
import hmac
import hashlib
from datetime import datetime, date
from unittest.mock import patch, MagicMock, AsyncMock

import pytest
import pytest_asyncio
from sqlalchemy import select, event, Text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.dialects.postgresql import JSONB, UUID, ARRAY
from sqlalchemy.pool import StaticPool

from app.database import Base


# Register JSONB -> JSON compilation for SQLite
from sqlalchemy.ext.compiler import compiles

@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "TEXT"

@compiles(UUID, "sqlite")
def _compile_uuid_sqlite(type_, compiler, **kw):
    return "VARCHAR(36)"

@compiles(ARRAY, "sqlite")
def _compile_array_sqlite(type_, compiler, **kw):
    return "TEXT"
from app.models.organization import Organization
from app.models.contact import Contact
from app.models.contract import Contract
from app.models.subscription import Subscription
from app.models.payment import Payment
from app.models.payment_provider import (
    PaymentProviderConfig,
    CustomerPaymentProfile,
    PaymentWebhookLog,
)
from app.models.invoice import Invoice
from app.models.activity import Activity
from app.models.task import Task
from app.integrations import stripe_service


# ── Test Fixtures ───────────────────────────────────


@pytest_asyncio.fixture
async def db():
    """Create an in-memory SQLite async database for testing."""
    import sqlite3
    import json as _json

    # Register adapters for types SQLite doesn't handle natively
    sqlite3.register_adapter(list, lambda val: _json.dumps(val))
    sqlite3.register_adapter(dict, lambda val: _json.dumps(val))

    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def org(db: AsyncSession):
    """Create a test organization."""
    org = Organization(
        id=uuid.uuid4(),
        name="Shield Home Security",
        slug="shield-home-security",
        email="admin@shieldsec.com",
        is_active=True,
        settings=None,  # avoid JSONB serialization issue on SQLite
    )
    db.add(org)
    await db.flush()
    return org


@pytest_asyncio.fixture
async def contact(db: AsyncSession, org: Organization):
    """Create a test contact."""
    c = Contact(
        id=uuid.uuid4(),
        organization_id=org.id,
        first_name="John",
        last_name="Parker",
        email="john.parker@example.com",
        phone="(469) 555-1234",
        tags=None,  # avoid ARRAY serialization issue on SQLite
    )
    db.add(c)
    await db.flush()
    return c


@pytest_asyncio.fixture
async def contract(db: AsyncSession, org: Organization, contact: Contact):
    """Create a test contract."""
    ct = Contract(
        id=uuid.uuid4(),
        organization_id=org.id,
        contact_id=contact.id,
        title="Home Security Monitoring - 36 Month",
        status="pending",
        monthly_amount=49.99,
        equipment_total=599.00,
        term_months=36,
        total_value=2398.64,
        equipment_lines=None,  # avoid JSONB serialization issue on SQLite
    )
    db.add(ct)
    await db.flush()
    return ct


# ── Test: Stripe Connect ────────────────────────────


@pytest.mark.asyncio
@patch("app.integrations.stripe_service.stripe")
async def test_create_connect_account(mock_stripe, db, org):
    """Test creating a Stripe Connect Express account."""
    mock_account = MagicMock()
    mock_account.id = "acct_test_1234"
    mock_stripe.Account.create.return_value = mock_account

    mock_link = MagicMock()
    mock_link.url = "https://connect.stripe.com/setup/e/test"
    mock_stripe.AccountLink.create.return_value = mock_link

    url = await stripe_service.create_connect_account(db, org.id)

    assert url == "https://connect.stripe.com/setup/e/test"
    mock_stripe.Account.create.assert_called_once()

    # Verify org was updated
    await db.refresh(org)
    assert org.stripe_account_id == "acct_test_1234"
    assert org.stripe_connected is False


@pytest.mark.asyncio
@patch("app.integrations.stripe_service.stripe")
async def test_complete_onboarding(mock_stripe, db, org):
    """Test completing Stripe onboarding."""
    org.stripe_account_id = "acct_test_1234"
    await db.flush()

    mock_account = MagicMock()
    mock_account.charges_enabled = True
    mock_account.details_submitted = True
    mock_account.business_profile.name = "Shield Security"
    mock_stripe.Account.retrieve.return_value = mock_account

    result = await stripe_service.complete_onboarding(db, org.id)

    assert result["connected"] is True
    assert result["onboarding_complete"] is True
    assert result["business_name"] == "Shield Security"

    await db.refresh(org)
    assert org.stripe_connected is True
    assert org.stripe_onboarding_complete is True


@pytest.mark.asyncio
@patch("app.integrations.stripe_service.stripe")
async def test_disconnect_stripe(mock_stripe, db, org):
    """Test disconnecting Stripe."""
    org.stripe_account_id = "acct_test_1234"
    org.stripe_connected = True
    org.stripe_onboarding_complete = True
    await db.flush()

    await stripe_service.disconnect_stripe(db, org.id)

    await db.refresh(org)
    assert org.stripe_account_id is None
    assert org.stripe_connected is False
    assert org.stripe_onboarding_complete is False


# ── Test: Customer Creation ─────────────────────────


@pytest.mark.asyncio
@patch("app.integrations.stripe_service.stripe")
async def test_create_customer(mock_stripe, db, org, contact):
    """Test creating a Stripe customer for a contact."""
    org.stripe_account_id = "acct_test_1234"
    org.stripe_connected = True
    await db.flush()

    mock_customer = MagicMock()
    mock_customer.id = "cus_test_5678"
    mock_stripe.Customer.create.return_value = mock_customer

    profile = await stripe_service.create_customer(db, org.id, contact.id)

    assert profile.external_customer_id == "cus_test_5678"
    assert profile.contact_id == contact.id
    assert profile.status == "active"

    # Verify provider config was created
    result = await db.execute(
        select(PaymentProviderConfig).where(
            PaymentProviderConfig.organization_id == org.id,
        )
    )
    config = result.scalar_one()
    assert config.provider_type == "stripe"


# ── Test: Setup Intent ──────────────────────────────


@pytest.mark.asyncio
@patch("app.integrations.stripe_service.stripe")
async def test_create_setup_intent(mock_stripe, db, org, contact):
    """Test creating a SetupIntent for payment method collection."""
    org.stripe_account_id = "acct_test_1234"
    org.stripe_connected = True
    await db.flush()

    # Create customer first
    mock_customer = MagicMock()
    mock_customer.id = "cus_test_5678"
    mock_stripe.Customer.create.return_value = mock_customer

    mock_setup = MagicMock()
    mock_setup.client_secret = "seti_test_secret_abc123"
    mock_setup.id = "seti_test_1234"
    mock_stripe.SetupIntent.create.return_value = mock_setup

    result = await stripe_service.create_setup_intent(db, org.id, contact.id)

    assert result["client_secret"] == "seti_test_secret_abc123"
    assert result["customer_id"] == "cus_test_5678"
    assert result["stripe_account_id"] == "acct_test_1234"


# ── Test: Attach Payment Method ─────────────────────


@pytest.mark.asyncio
@patch("app.integrations.stripe_service.stripe")
async def test_attach_payment_method(mock_stripe, db, org, contact):
    """Test attaching a payment method to a customer."""
    org.stripe_account_id = "acct_test_1234"
    org.stripe_connected = True
    await db.flush()

    # Create provider config
    provider_config = PaymentProviderConfig(
        organization_id=org.id,
        provider_type="stripe",
        display_name="Stripe",
        is_active=True,
    )
    db.add(provider_config)
    await db.flush()

    # Create customer profile
    profile = CustomerPaymentProfile(
        organization_id=org.id,
        contact_id=contact.id,
        provider_config_id=provider_config.id,
        external_customer_id="cus_test_5678",
        status="active",
    )
    db.add(profile)
    await db.flush()

    # Mock payment method
    mock_pm = MagicMock()
    mock_pm.card.last4 = "4242"
    mock_pm.card.brand = "visa"
    mock_pm.card.exp_month = 12
    mock_pm.card.exp_year = 2027
    mock_stripe.PaymentMethod.retrieve.return_value = mock_pm
    mock_stripe.Customer.modify.return_value = MagicMock()

    updated = await stripe_service.attach_payment_method(
        db, org.id, contact.id, "pm_test_1234"
    )

    assert updated.payment_method_last4 == "4242"
    assert updated.payment_method_brand == "visa"
    assert updated.external_payment_id == "pm_test_1234"
    assert updated.is_default is True


# ── Test: Create Subscription ───────────────────────


@pytest.mark.asyncio
@patch("app.integrations.stripe_service.stripe")
async def test_create_subscription(mock_stripe, db, org, contact, contract):
    """Test creating a Stripe subscription for a contract."""
    org.stripe_account_id = "acct_test_1234"
    org.stripe_connected = True
    await db.flush()

    # Create provider config
    provider_config = PaymentProviderConfig(
        organization_id=org.id,
        provider_type="stripe",
        display_name="Stripe",
        is_active=True,
    )
    db.add(provider_config)
    await db.flush()

    # Create customer profile with payment method
    profile = CustomerPaymentProfile(
        organization_id=org.id,
        contact_id=contact.id,
        provider_config_id=provider_config.id,
        external_customer_id="cus_test_5678",
        external_payment_id="pm_test_1234",
        payment_method_type="card",
        payment_method_last4="4242",
        status="active",
    )
    db.add(profile)
    await db.flush()

    # Mock Stripe product and price
    mock_product = MagicMock()
    mock_product.id = "prod_test_1234"
    mock_stripe.Product.list.return_value = MagicMock(data=[mock_product])

    mock_price = MagicMock()
    mock_price.id = "price_test_1234"
    mock_stripe.Price.create.return_value = mock_price

    # Mock Stripe subscription
    mock_sub = MagicMock()
    mock_sub.id = "sub_test_1234"
    mock_sub.current_period_start = int(datetime(2026, 2, 27).timestamp())
    mock_sub.current_period_end = int(datetime(2026, 3, 27).timestamp())
    mock_stripe.Subscription.create.return_value = mock_sub

    sub = await stripe_service.create_subscription(db, org.id, contract.id)

    assert sub.external_subscription_id == "sub_test_1234"
    assert sub.status == "active"
    assert float(sub.amount) == 49.99
    assert sub.billing_interval == "monthly"

    # Verify contract was activated
    await db.refresh(contract)
    assert contract.status == "active"
    assert contract.signed_at is not None

    # Verify activity was logged
    result = await db.execute(
        select(Activity).where(Activity.type == "subscription_created")
    )
    activity = result.scalar_one()
    assert "49.99" in activity.subject


# ── Test: One-Time Equipment Charge ─────────────────


@pytest.mark.asyncio
@patch("app.integrations.stripe_service.stripe")
async def test_one_time_charge(mock_stripe, db, org, contact, contract):
    """Test charging equipment total as a one-time payment."""
    org.stripe_account_id = "acct_test_1234"
    org.stripe_connected = True
    await db.flush()

    # Setup provider config and profile
    provider_config = PaymentProviderConfig(
        organization_id=org.id,
        provider_type="stripe",
        display_name="Stripe",
        is_active=True,
    )
    db.add(provider_config)
    await db.flush()

    profile = CustomerPaymentProfile(
        organization_id=org.id,
        contact_id=contact.id,
        provider_config_id=provider_config.id,
        external_customer_id="cus_test_5678",
        external_payment_id="pm_test_1234",
        payment_method_type="card",
        payment_method_last4="4242",
        status="active",
    )
    db.add(profile)
    await db.flush()

    # Mock PaymentIntent
    mock_pi = MagicMock()
    mock_pi.id = "pi_test_equipment"
    mock_pi.status = "succeeded"
    mock_stripe.PaymentIntent.create.return_value = mock_pi

    payment = await stripe_service.create_one_time_charge(db, org.id, contract.id)

    assert float(payment.amount) == 599.00
    assert payment.status == "succeeded"
    assert payment.external_payment_id == "pi_test_equipment"

    # Verify it was called with the correct amount in cents
    call_kwargs = mock_stripe.PaymentIntent.create.call_args
    assert call_kwargs.kwargs["amount"] == 59900


# ── Test: Webhook -- Payment Succeeded ──────────────


@pytest.mark.asyncio
@patch("app.integrations.stripe_service.stripe")
@patch("app.integrations.stripe_service.settings")
async def test_webhook_payment_succeeded(mock_settings, mock_stripe, db, org, contact, contract):
    """Test webhook processing for invoice.payment_succeeded."""
    org.stripe_account_id = "acct_test_1234"
    org.stripe_connected = True
    await db.flush()

    mock_settings.stripe_secret_key = "sk_test_123"
    mock_settings.stripe_webhook_secret = "whsec_test_123"
    mock_settings.cors_origins_list = ["http://localhost:5173"]

    # Create provider config and subscription
    provider_config = PaymentProviderConfig(
        organization_id=org.id,
        provider_type="stripe",
        display_name="Stripe",
        is_active=True,
    )
    db.add(provider_config)
    await db.flush()

    sub = Subscription(
        organization_id=org.id,
        contract_id=contract.id,
        contact_id=contact.id,
        provider_config_id=provider_config.id,
        external_subscription_id="sub_test_1234",
        status="active",
        amount=49.99,
        billing_interval="monthly",
    )
    db.add(sub)
    await db.flush()

    # Build a mock Stripe event
    event_data = {
        "id": "evt_test_success_1",
        "type": "invoice.payment_succeeded",
        "account": "acct_test_1234",
        "data": {
            "object": {
                "id": "in_test_1234",
                "subscription": "sub_test_1234",
                "amount_paid": 4999,
                "currency": "usd",
                "payment_intent": "pi_test_success",
                "period_start": int(datetime(2026, 2, 27).timestamp()),
                "period_end": int(datetime(2026, 3, 27).timestamp()),
                "metadata": {
                    "lsrv_org_id": str(org.id),
                    "lsrv_contact_id": str(contact.id),
                    "lsrv_contract_id": str(contract.id),
                },
            }
        },
    }

    # Mock Stripe event construction
    mock_event = MagicMock()
    mock_event.type = "invoice.payment_succeeded"
    mock_event.id = "evt_test_success_1"
    mock_event.get.return_value = "acct_test_1234"
    mock_event.to_dict.return_value = event_data

    # Make the data.object accessible
    invoice_obj = MagicMock()
    invoice_obj.id = "in_test_1234"
    invoice_obj.subscription = "sub_test_1234"
    invoice_obj.amount_paid = 4999
    invoice_obj.currency = "usd"
    invoice_obj.payment_intent = "pi_test_success"
    invoice_obj.period_start = int(datetime(2026, 2, 27).timestamp())
    invoice_obj.period_end = int(datetime(2026, 3, 27).timestamp())
    invoice_obj.metadata = {
        "lsrv_org_id": str(org.id),
        "lsrv_contact_id": str(contact.id),
        "lsrv_contract_id": str(contract.id),
    }
    mock_event.data.object = invoice_obj

    mock_stripe.Webhook.construct_event.return_value = mock_event

    result = await stripe_service.process_webhook_event(
        db, b'payload', 'sig_header'
    )

    assert result["status"] == "processed"
    assert result["event_type"] == "invoice.payment_succeeded"

    # Verify payment record created
    payments = (await db.execute(select(Payment).where(Payment.status == "succeeded"))).scalars().all()
    assert len(payments) == 1
    assert float(payments[0].amount) == 49.99

    # Verify subscription updated
    await db.refresh(sub)
    assert sub.failed_payment_count == 0
    assert sub.last_payment_at is not None

    # Verify activity logged
    activities = (await db.execute(
        select(Activity).where(Activity.type == "payment_succeeded")
    )).scalars().all()
    assert len(activities) == 1

    # Verify webhook log created
    logs = (await db.execute(select(PaymentWebhookLog))).scalars().all()
    assert len(logs) == 1
    assert logs[0].processing_status == "processed"


# ── Test: Webhook -- Payment Failed ─────────────────


@pytest.mark.asyncio
@patch("app.services.notification_service.send_email", new_callable=AsyncMock)
@patch("app.integrations.stripe_service.stripe")
@patch("app.integrations.stripe_service.settings")
async def test_webhook_payment_failed(mock_settings, mock_stripe, mock_send_email, db, org, contact, contract):
    """Test webhook processing for invoice.payment_failed."""
    org.stripe_account_id = "acct_test_1234"
    org.stripe_connected = True
    await db.flush()

    mock_settings.stripe_secret_key = "sk_test_123"
    mock_settings.stripe_webhook_secret = "whsec_test_123"
    mock_settings.cors_origins_list = ["http://localhost:5173"]

    provider_config = PaymentProviderConfig(
        organization_id=org.id,
        provider_type="stripe",
        display_name="Stripe",
        is_active=True,
    )
    db.add(provider_config)
    await db.flush()

    sub = Subscription(
        organization_id=org.id,
        contract_id=contract.id,
        contact_id=contact.id,
        provider_config_id=provider_config.id,
        external_subscription_id="sub_test_1234",
        status="active",
        amount=49.99,
        billing_interval="monthly",
        failed_payment_count=0,
    )
    db.add(sub)
    await db.flush()

    # Build mock event
    mock_event = MagicMock()
    mock_event.type = "invoice.payment_failed"
    mock_event.id = "evt_test_fail_1"
    mock_event.get.return_value = "acct_test_1234"
    mock_event.to_dict.return_value = {"id": "evt_test_fail_1"}

    invoice_obj = MagicMock()
    invoice_obj.id = "in_test_fail"
    invoice_obj.subscription = "sub_test_1234"
    invoice_obj.amount_due = 4999
    invoice_obj.currency = "usd"
    invoice_obj.payment_intent = "pi_test_fail"
    invoice_obj.attempt_count = 1
    invoice_obj.charge = "ch_test_fail"
    invoice_obj.metadata = {
        "lsrv_org_id": str(org.id),
        "lsrv_contact_id": str(contact.id),
    }
    mock_event.data.object = invoice_obj

    # Mock charge retrieval for failure details
    mock_charge = MagicMock()
    mock_charge.failure_code = "card_declined"
    mock_charge.failure_message = "Your card was declined."
    mock_stripe.Charge.retrieve.return_value = mock_charge

    mock_stripe.Webhook.construct_event.return_value = mock_event

    result = await stripe_service.process_webhook_event(
        db, b'payload', 'sig_header'
    )

    assert result["status"] == "processed"

    # Verify failed payment record
    payments = (await db.execute(select(Payment).where(Payment.status == "failed"))).scalars().all()
    assert len(payments) == 1
    assert payments[0].failure_code == "card_declined"

    # Verify subscription failure count increased
    await db.refresh(sub)
    assert sub.failed_payment_count == 1

    # Verify task was created for admin
    tasks = (await db.execute(select(Task))).scalars().all()
    assert len(tasks) == 1
    assert "Failed payment" in tasks[0].title
    assert tasks[0].priority == "medium"

    # Verify activity logged
    activities = (await db.execute(
        select(Activity).where(Activity.type == "payment_failed")
    )).scalars().all()
    assert len(activities) == 1


# ── Test: Webhook -- Subscription Deleted ───────────


@pytest.mark.asyncio
@patch("app.integrations.stripe_service.stripe")
@patch("app.integrations.stripe_service.settings")
async def test_webhook_subscription_deleted(mock_settings, mock_stripe, db, org, contact, contract):
    """Test webhook processing for customer.subscription.deleted."""
    org.stripe_account_id = "acct_test_1234"
    org.stripe_connected = True
    await db.flush()

    mock_settings.stripe_secret_key = "sk_test_123"
    mock_settings.stripe_webhook_secret = "whsec_test_123"
    mock_settings.cors_origins_list = ["http://localhost:5173"]

    provider_config = PaymentProviderConfig(
        organization_id=org.id,
        provider_type="stripe",
        display_name="Stripe",
        is_active=True,
    )
    db.add(provider_config)
    await db.flush()

    sub = Subscription(
        organization_id=org.id,
        contract_id=contract.id,
        contact_id=contact.id,
        provider_config_id=provider_config.id,
        external_subscription_id="sub_test_cancel",
        status="active",
        amount=49.99,
        billing_interval="monthly",
    )
    db.add(sub)

    contract.status = "active"
    await db.flush()

    mock_event = MagicMock()
    mock_event.type = "customer.subscription.deleted"
    mock_event.id = "evt_test_cancel_1"
    mock_event.get.return_value = "acct_test_1234"
    mock_event.to_dict.return_value = {"id": "evt_test_cancel_1"}

    sub_obj = MagicMock()
    sub_obj.id = "sub_test_cancel"
    sub_obj.metadata = {"lsrv_org_id": str(org.id)}
    mock_event.data.object = sub_obj

    mock_stripe.Webhook.construct_event.return_value = mock_event

    result = await stripe_service.process_webhook_event(
        db, b'payload', 'sig_header'
    )

    assert result["status"] == "processed"

    # Verify subscription cancelled
    await db.refresh(sub)
    assert sub.status == "cancelled"
    assert sub.cancelled_at is not None

    # Verify contract cancelled
    await db.refresh(contract)
    assert contract.status == "cancelled"

    # Verify activity logged
    activities = (await db.execute(
        select(Activity).where(Activity.type == "subscription_cancelled")
    )).scalars().all()
    assert len(activities) == 1


# ── Test: Webhook -- Charge Refunded ────────────────


@pytest.mark.asyncio
@patch("app.integrations.stripe_service.stripe")
@patch("app.integrations.stripe_service.settings")
async def test_webhook_charge_refunded(mock_settings, mock_stripe, db, org, contact):
    """Test webhook processing for charge.refunded."""
    org.stripe_account_id = "acct_test_1234"
    org.stripe_connected = True
    await db.flush()

    mock_settings.stripe_secret_key = "sk_test_123"
    mock_settings.stripe_webhook_secret = "whsec_test_123"
    mock_settings.cors_origins_list = ["http://localhost:5173"]

    provider_config = PaymentProviderConfig(
        organization_id=org.id,
        provider_type="stripe",
        display_name="Stripe",
        is_active=True,
        settings=None,
        credentials=None,
    )
    db.add(provider_config)
    await db.flush()

    profile = CustomerPaymentProfile(
        organization_id=org.id,
        contact_id=contact.id,
        provider_config_id=provider_config.id,
        external_customer_id="cus_test_5678",
        status="active",
    )
    db.add(profile)
    await db.flush()

    mock_event = MagicMock()
    mock_event.type = "charge.refunded"
    mock_event.id = "evt_test_refund_1"
    mock_event.get.return_value = "acct_test_1234"
    mock_event.to_dict.return_value = {"id": "evt_test_refund_1"}

    charge_obj = MagicMock()
    charge_obj.id = "ch_test_refund"
    charge_obj.amount_refunded = 4999
    charge_obj.currency = "usd"
    charge_obj.customer = "cus_test_5678"
    charge_obj.metadata = {}
    mock_event.data.object = charge_obj

    mock_stripe.Webhook.construct_event.return_value = mock_event

    result = await stripe_service.process_webhook_event(
        db, b'payload', 'sig_header'
    )

    assert result["status"] == "processed"

    # Verify refund payment record
    payments = (await db.execute(select(Payment).where(Payment.status == "refunded"))).scalars().all()
    assert len(payments) == 1
    assert float(payments[0].amount) == 49.99

    # Verify activity logged
    activities = (await db.execute(
        select(Activity).where(Activity.type == "payment_refunded")
    )).scalars().all()
    assert len(activities) == 1


# ── Test: Full Flow ─────────────────────────────────


@pytest.mark.asyncio
@patch("app.integrations.stripe_service.stripe")
@patch("app.integrations.stripe_service.settings")
async def test_full_contract_to_payment_flow(mock_settings, mock_stripe, db, org, contact, contract):
    """
    Test the complete flow:
    1. Connect Stripe
    2. Create customer
    3. Attach payment method
    4. Create subscription
    5. Process successful payment webhook
    6. Process failed payment webhook
    7. Verify all records
    """
    mock_settings.stripe_secret_key = "sk_test_123"
    mock_settings.stripe_webhook_secret = "whsec_test_123"
    mock_settings.cors_origins_list = ["http://localhost:5173"]

    # 1. Connect Stripe
    mock_account = MagicMock()
    mock_account.id = "acct_test_full"
    mock_account.charges_enabled = True
    mock_account.details_submitted = True
    mock_account.business_profile.name = "Shield Security"
    mock_stripe.Account.create.return_value = mock_account
    mock_stripe.Account.retrieve.return_value = mock_account
    mock_stripe.AccountLink.create.return_value = MagicMock(url="https://stripe.com/setup")

    await stripe_service.create_connect_account(db, org.id)
    await stripe_service.complete_onboarding(db, org.id)

    await db.refresh(org)
    assert org.stripe_connected is True

    # 2. Create customer
    mock_customer = MagicMock()
    mock_customer.id = "cus_full_test"
    mock_stripe.Customer.create.return_value = mock_customer

    profile = await stripe_service.create_customer(db, org.id, contact.id)
    assert profile.external_customer_id == "cus_full_test"

    # 3. Attach payment method
    mock_pm = MagicMock()
    mock_pm.card.last4 = "4242"
    mock_pm.card.brand = "visa"
    mock_pm.card.exp_month = 12
    mock_pm.card.exp_year = 2027
    mock_stripe.PaymentMethod.retrieve.return_value = mock_pm
    mock_stripe.Customer.modify.return_value = MagicMock()

    profile = await stripe_service.attach_payment_method(
        db, org.id, contact.id, "pm_full_test"
    )
    assert profile.payment_method_last4 == "4242"

    # 4. Create subscription
    mock_product = MagicMock()
    mock_product.id = "prod_full_test"
    mock_stripe.Product.list.return_value = MagicMock(data=[mock_product])
    mock_stripe.Price.create.return_value = MagicMock(id="price_full_test")

    mock_sub = MagicMock()
    mock_sub.id = "sub_full_test"
    mock_sub.current_period_start = int(datetime(2026, 2, 27).timestamp())
    mock_sub.current_period_end = int(datetime(2026, 3, 27).timestamp())
    mock_stripe.Subscription.create.return_value = mock_sub

    sub = await stripe_service.create_subscription(db, org.id, contract.id)
    assert sub.external_subscription_id == "sub_full_test"
    assert sub.status == "active"

    # 5. Process successful payment webhook
    mock_event = MagicMock()
    mock_event.type = "invoice.payment_succeeded"
    mock_event.id = "evt_full_success"
    mock_event.get.return_value = "acct_test_full"
    mock_event.to_dict.return_value = {"id": "evt_full_success"}

    invoice_obj = MagicMock()
    invoice_obj.id = "in_full_1"
    invoice_obj.subscription = "sub_full_test"
    invoice_obj.amount_paid = 4999
    invoice_obj.currency = "usd"
    invoice_obj.payment_intent = "pi_full_success"
    invoice_obj.period_start = int(datetime(2026, 2, 27).timestamp())
    invoice_obj.period_end = int(datetime(2026, 3, 27).timestamp())
    invoice_obj.metadata = {"lsrv_org_id": str(org.id), "lsrv_contact_id": str(contact.id)}
    mock_event.data.object = invoice_obj
    mock_stripe.Webhook.construct_event.return_value = mock_event

    result = await stripe_service.process_webhook_event(db, b'test', 'sig')
    assert result["status"] == "processed"

    # Verify payment record
    payments = (await db.execute(
        select(Payment).where(Payment.status == "succeeded")
    )).scalars().all()
    assert len(payments) == 1
    assert float(payments[0].amount) == 49.99

    # 6. Process failed payment webhook
    mock_event2 = MagicMock()
    mock_event2.type = "invoice.payment_failed"
    mock_event2.id = "evt_full_fail"
    mock_event2.get.return_value = "acct_test_full"
    mock_event2.to_dict.return_value = {"id": "evt_full_fail"}

    invoice_obj2 = MagicMock()
    invoice_obj2.id = "in_full_fail"
    invoice_obj2.subscription = "sub_full_test"
    invoice_obj2.amount_due = 4999
    invoice_obj2.currency = "usd"
    invoice_obj2.payment_intent = "pi_full_fail"
    invoice_obj2.attempt_count = 1
    invoice_obj2.charge = None
    invoice_obj2.metadata = {"lsrv_org_id": str(org.id), "lsrv_contact_id": str(contact.id)}
    mock_event2.data.object = invoice_obj2
    mock_stripe.Webhook.construct_event.return_value = mock_event2

    # Patch the email sending in the handler
    with patch("app.services.notification_service.send_email", new_callable=AsyncMock):
        result2 = await stripe_service.process_webhook_event(db, b'test2', 'sig2')
    assert result2["status"] == "processed"

    # 7. Verify all records
    all_payments = (await db.execute(select(Payment))).scalars().all()
    assert len(all_payments) == 2  # 1 succeeded + 1 failed

    all_activities = (await db.execute(select(Activity))).scalars().all()
    # subscription_created + payment_succeeded + payment_failed
    assert len(all_activities) >= 3

    all_tasks = (await db.execute(select(Task))).scalars().all()
    assert len(all_tasks) == 1  # failed payment task

    all_logs = (await db.execute(select(PaymentWebhookLog))).scalars().all()
    assert len(all_logs) == 2  # succeeded + failed events

    # Verify subscription state
    await db.refresh(sub)
    assert sub.failed_payment_count == 1
    assert sub.last_payment_at is not None

    # Verify contract is active (was activated when subscription created)
    await db.refresh(contract)
    assert contract.status == "active"

    print("FULL FLOW TEST PASSED: Connect -> Customer -> Payment Method -> "
          "Subscription -> Payment Succeeded -> Payment Failed")
