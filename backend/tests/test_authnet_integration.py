"""
Authorize.net integration tests -- CIM, ARB, one-time charges, and webhooks.

Uses unittest.mock to mock Authorize.net SDK calls, testing our service logic
without requiring actual Authorize.net credentials.
"""

import json
import uuid
from datetime import datetime, date
from unittest.mock import patch, MagicMock, PropertyMock

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.dialects.postgresql import JSONB, UUID, ARRAY
from sqlalchemy.pool import StaticPool

from app.database import Base

# Register JSONB -> TEXT compilation for SQLite
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
from app.integrations import authnet_service


# ── Test Fixtures ───────────────────────────────────


@pytest_asyncio.fixture
async def db():
    """Create an in-memory SQLite async database for testing."""
    import sqlite3
    import json as _json

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
        settings=None,
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
        first_name="Jane",
        last_name="Smith",
        email="jane.smith@example.com",
        phone="(555) 123-4567",
        tags=None,
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
        equipment_lines=None,
    )
    db.add(ct)
    await db.flush()
    return ct


@pytest_asyncio.fixture
async def authnet_config(db: AsyncSession, org: Organization):
    """Create an active Authorize.net provider config."""
    config = PaymentProviderConfig(
        organization_id=org.id,
        provider_type="authorize_net",
        display_name="Authorize.net",
        is_active=True,
        credentials={
            "api_login_id": "test_login",
            "transaction_key": "test_key",
            "signature_key": "test_sig",
        },
        environment="sandbox",
        settings=None,
    )
    db.add(config)
    await db.flush()
    return config


@pytest_asyncio.fixture
async def customer_profile(
    db: AsyncSession, org: Organization, contact: Contact, authnet_config: PaymentProviderConfig
):
    """Create a customer payment profile with a payment method."""
    profile = CustomerPaymentProfile(
        organization_id=org.id,
        contact_id=contact.id,
        provider_config_id=authnet_config.id,
        external_customer_id="12345678",
        external_payment_id="87654321",
        payment_method_type="card",
        payment_method_last4="4242",
        payment_method_brand="visa",
        is_default=True,
        status="active",
    )
    db.add(profile)
    await db.flush()
    return profile


# ── Test: Connect / Disconnect ────────────────────


@pytest.mark.asyncio
async def test_connect_authnet(db, org):
    """Test connecting Authorize.net credentials."""
    result = await authnet_service.connect_authnet(
        db,
        org.id,
        api_login_id="test_login_id",
        transaction_key="test_txn_key",
        signature_key="test_sig_key",
        environment="sandbox",
    )

    assert result["connected"] is True
    assert result["environment"] == "sandbox"

    # Verify config was saved
    config = await db.execute(
        select(PaymentProviderConfig).where(
            PaymentProviderConfig.organization_id == org.id,
            PaymentProviderConfig.provider_type == "authorize_net",
        )
    )
    config = config.scalar_one()
    assert config.is_active is True
    assert config.credentials["api_login_id"] == "test_login_id"


@pytest.mark.asyncio
async def test_disconnect_authnet(db, org, authnet_config):
    """Test disconnecting Authorize.net."""
    await authnet_service.disconnect_authnet(db, org.id)

    await db.refresh(authnet_config)
    assert authnet_config.is_active is False


@pytest.mark.asyncio
async def test_get_authnet_status_connected(db, org, authnet_config):
    """Test getting status when connected."""
    result = await authnet_service.get_authnet_status(db, org.id)
    assert result["connected"] is True
    assert result["provider_type"] == "authorize_net"
    assert result["environment"] == "sandbox"


@pytest.mark.asyncio
async def test_get_authnet_status_not_connected(db, org):
    """Test getting status when not connected."""
    result = await authnet_service.get_authnet_status(db, org.id)
    assert result["connected"] is False


# ── Test: CIM Customer Creation ───────────────────


@pytest.mark.asyncio
@patch("app.integrations.authnet_service.createCustomerProfileController")
async def test_create_customer(mock_controller_cls, db, org, contact, authnet_config):
    """Test creating a CIM customer profile."""
    mock_response = MagicMock()
    mock_response.messages.resultCode = "Ok"
    mock_response.customerProfileId = "99887766"

    mock_controller = MagicMock()
    mock_controller.getresponse.return_value = mock_response
    mock_controller_cls.return_value = mock_controller

    profile = await authnet_service.create_customer(db, org.id, contact.id)

    assert profile.external_customer_id == "99887766"
    assert profile.contact_id == contact.id
    assert profile.status == "active"
    mock_controller.execute.assert_called_once()


@pytest.mark.asyncio
@patch("app.integrations.authnet_service.createCustomerProfileController")
async def test_create_customer_duplicate_error(mock_controller_cls, db, org, contact, authnet_config):
    """Test handling duplicate customer profile error."""
    mock_msg = MagicMock()
    mock_msg.text = "A duplicate record with ID 12345 already exists."

    mock_response = MagicMock()
    mock_response.messages.resultCode = "Error"
    mock_response.messages.message = [mock_msg]

    mock_controller = MagicMock()
    mock_controller.getresponse.return_value = mock_response
    mock_controller_cls.return_value = mock_controller

    with pytest.raises(ValueError, match="Customer profile already exists"):
        await authnet_service.create_customer(db, org.id, contact.id)


# ── Test: Add Payment Profile ─────────────────────


@pytest.mark.asyncio
@patch("app.integrations.authnet_service.createCustomerPaymentProfileController")
async def test_add_payment_profile(mock_controller_cls, db, org, contact, authnet_config):
    """Test adding a payment profile (card) to CIM customer."""
    # Create base customer profile first (without payment)
    base_profile = CustomerPaymentProfile(
        organization_id=org.id,
        contact_id=contact.id,
        provider_config_id=authnet_config.id,
        external_customer_id="99887766",
        status="active",
    )
    db.add(base_profile)
    await db.flush()

    mock_response = MagicMock()
    mock_response.messages.resultCode = "Ok"
    mock_response.customerPaymentProfileId = "55443322"

    mock_controller = MagicMock()
    mock_controller.getresponse.return_value = mock_response
    mock_controller_cls.return_value = mock_controller

    updated = await authnet_service.add_payment_profile(
        db, org.id, contact.id,
        card_number="4111111111111111",
        expiration_date="2028-12",
        card_code="123",
    )

    assert updated.external_payment_id == "55443322"
    assert updated.payment_method_last4 == "1111"
    assert updated.payment_method_brand == "visa"
    assert updated.payment_method_exp_year == 2028
    assert updated.payment_method_exp_month == 12
    assert updated.is_default is True
    mock_controller.execute.assert_called_once()


# ── Test: One-Time Charge ─────────────────────────


@pytest.mark.asyncio
@patch("app.integrations.authnet_service.createTransactionController")
async def test_charge_customer_success(mock_controller_cls, db, org, contact, authnet_config, customer_profile):
    """Test a successful one-time charge."""
    mock_tr = MagicMock()
    mock_tr.transId = "60012345678"
    mock_tr.responseCode = "1"

    mock_response = MagicMock()
    mock_response.messages.resultCode = "Ok"
    mock_response.transactionResponse = mock_tr

    mock_controller = MagicMock()
    mock_controller.getresponse.return_value = mock_response
    mock_controller_cls.return_value = mock_controller

    payment = await authnet_service.charge_customer(
        db, org.id, contact.id,
        amount=199.99,
        description="Equipment install",
    )

    assert payment.status == "succeeded"
    assert float(payment.amount) == 199.99
    assert payment.external_payment_id == "60012345678"
    assert payment.currency == "usd"

    # Verify activity was logged
    activities = (await db.execute(
        select(Activity).where(Activity.type == "payment_succeeded")
    )).scalars().all()
    assert len(activities) == 1


@pytest.mark.asyncio
@patch("app.integrations.authnet_service.createTransactionController")
async def test_charge_customer_declined(mock_controller_cls, db, org, contact, authnet_config, customer_profile):
    """Test a declined charge."""
    mock_error = MagicMock()
    mock_error.errorCode = "2"
    mock_error.errorText = "This transaction has been declined."

    mock_tr = MagicMock()
    mock_tr.transId = "60012345679"
    mock_tr.responseCode = "2"
    mock_tr.errors.error = [mock_error]

    mock_response = MagicMock()
    mock_response.messages.resultCode = "Ok"
    mock_response.transactionResponse = mock_tr

    mock_controller = MagicMock()
    mock_controller.getresponse.return_value = mock_response
    mock_controller_cls.return_value = mock_controller

    payment = await authnet_service.charge_customer(
        db, org.id, contact.id,
        amount=199.99,
        description="Equipment install",
    )

    assert payment.status == "failed"
    assert payment.failure_code == "2"
    assert "declined" in payment.failure_message.lower()


# ── Test: ARB Subscription ────────────────────────


@pytest.mark.asyncio
@patch("app.integrations.authnet_service.ARBCreateSubscriptionController")
async def test_create_subscription(mock_controller_cls, db, org, contact, contract, authnet_config, customer_profile):
    """Test creating an ARB subscription."""
    mock_response = MagicMock()
    mock_response.messages.resultCode = "Ok"
    mock_response.subscriptionId = "ARB-998877"

    mock_controller = MagicMock()
    mock_controller.getresponse.return_value = mock_response
    mock_controller_cls.return_value = mock_controller

    sub = await authnet_service.create_subscription(db, org.id, contract.id)

    assert sub.external_subscription_id == "ARB-998877"
    assert sub.status == "active"
    assert float(sub.amount) == 49.99
    assert sub.billing_interval == "monthly"

    # Verify contract activated
    await db.refresh(contract)
    assert contract.status == "active"
    assert contract.signed_at is not None

    # Verify activity logged
    activities = (await db.execute(
        select(Activity).where(Activity.type == "subscription_created")
    )).scalars().all()
    assert len(activities) == 1
    assert "49.99" in activities[0].subject


@pytest.mark.asyncio
@patch("app.integrations.authnet_service.ARBCancelSubscriptionController")
async def test_cancel_subscription(mock_controller_cls, db, org, contact, contract, authnet_config, customer_profile):
    """Test cancelling an ARB subscription."""
    # Create subscription first
    sub = Subscription(
        organization_id=org.id,
        contract_id=contract.id,
        contact_id=contact.id,
        provider_config_id=authnet_config.id,
        customer_payment_profile_id=customer_profile.id,
        external_subscription_id="998877",
        status="active",
        amount=49.99,
        billing_interval="monthly",
    )
    db.add(sub)
    contract.status = "active"
    await db.flush()

    mock_response = MagicMock()
    mock_response.messages.resultCode = "Ok"

    mock_controller = MagicMock()
    mock_controller.getresponse.return_value = mock_response
    mock_controller_cls.return_value = mock_controller

    cancelled = await authnet_service.cancel_subscription(
        db, org.id, sub.id, reason="Customer request"
    )

    assert cancelled.status == "cancelled"
    assert cancelled.cancelled_at is not None
    assert cancelled.cancellation_reason == "Customer request"

    # Verify contract was also cancelled
    await db.refresh(contract)
    assert contract.status == "cancelled"

    # Verify activity logged
    activities = (await db.execute(
        select(Activity).where(Activity.type == "subscription_cancelled")
    )).scalars().all()
    assert len(activities) == 1


# ── Test: Webhook -- Payment Success ──────────────


@pytest.mark.asyncio
async def test_webhook_payment_success(db, org, contact, authnet_config, customer_profile):
    """Test webhook processing for successful payment."""
    payload = {
        "notificationId": "notif-001",
        "eventType": "net.authorize.payment.authcapture.created",
        "payload": {
            "id": "60012345678",
            "authAmount": 49.99,
            "customerProfile": {
                "customerProfileId": customer_profile.external_customer_id,
            },
        },
    }

    result = await authnet_service.process_webhook_event(
        db, payload, signature="", org_id=org.id
    )

    assert result["status"] == "processed"
    assert result["event_type"] == "net.authorize.payment.authcapture.created"

    # Verify payment record
    payments = (await db.execute(
        select(Payment).where(Payment.status == "succeeded")
    )).scalars().all()
    assert len(payments) == 1
    assert float(payments[0].amount) == 49.99

    # Verify activity
    activities = (await db.execute(
        select(Activity).where(Activity.type == "payment_succeeded")
    )).scalars().all()
    assert len(activities) == 1

    # Verify webhook log
    logs = (await db.execute(select(PaymentWebhookLog))).scalars().all()
    assert len(logs) == 1
    assert logs[0].processing_status == "processed"


# ── Test: Webhook -- Payment Failed ───────────────


@pytest.mark.asyncio
async def test_webhook_payment_failed(db, org, contact, authnet_config, customer_profile):
    """Test webhook processing for failed/declined payment."""
    payload = {
        "notificationId": "notif-002",
        "eventType": "net.authorize.payment.fraud.declined",
        "payload": {
            "id": "60012345679",
            "authAmount": 49.99,
            "customerProfile": {
                "customerProfileId": customer_profile.external_customer_id,
            },
        },
    }

    result = await authnet_service.process_webhook_event(
        db, payload, signature="", org_id=org.id
    )

    assert result["status"] == "processed"

    # Verify failed payment
    payments = (await db.execute(
        select(Payment).where(Payment.status == "failed")
    )).scalars().all()
    assert len(payments) == 1
    assert payments[0].failure_code == "declined"

    # Verify task created
    tasks = (await db.execute(select(Task))).scalars().all()
    assert len(tasks) == 1
    assert "Failed payment" in tasks[0].title
    assert tasks[0].priority == "high"

    # Verify activity
    activities = (await db.execute(
        select(Activity).where(Activity.type == "payment_failed")
    )).scalars().all()
    assert len(activities) == 1


# ── Test: Webhook -- Refund ───────────────────────


@pytest.mark.asyncio
async def test_webhook_refund(db, org, contact, authnet_config, customer_profile):
    """Test webhook processing for a refund."""
    payload = {
        "notificationId": "notif-003",
        "eventType": "net.authorize.payment.refund.created",
        "payload": {
            "id": "60012345680",
            "authAmount": 49.99,
            "customerProfile": {
                "customerProfileId": customer_profile.external_customer_id,
            },
        },
    }

    result = await authnet_service.process_webhook_event(
        db, payload, signature="", org_id=org.id
    )

    assert result["status"] == "processed"

    # Verify refund record
    payments = (await db.execute(
        select(Payment).where(Payment.status == "refunded")
    )).scalars().all()
    assert len(payments) == 1
    assert float(payments[0].amount_refunded) == 49.99

    # Verify activity
    activities = (await db.execute(
        select(Activity).where(Activity.type == "payment_refunded")
    )).scalars().all()
    assert len(activities) == 1


# ── Test: Webhook -- Unknown Org ──────────────────


@pytest.mark.asyncio
async def test_webhook_unknown_org(db):
    """Test webhook with no matching org is ignored."""
    payload = {
        "notificationId": "notif-unknown",
        "eventType": "net.authorize.payment.authcapture.created",
        "payload": {"id": "123", "authAmount": 10.0},
    }

    result = await authnet_service.process_webhook_event(
        db, payload, signature=""
    )

    assert result["status"] == "ignored"
    assert result["reason"] == "unknown_organization"


# ── Test: Webhook Signature Verification ──────────


def test_webhook_signature_verification():
    """Test HMAC-SHA512 webhook signature verification."""
    sig_key = "MyTestSignatureKey123"
    payload = {"eventType": "test", "payload": {"id": "1"}}

    import hashlib
    import hmac as hmac_mod
    payload_str = json.dumps(payload, separators=(",", ":"))
    expected_sig = hmac_mod.new(
        sig_key.encode("utf-8"),
        payload_str.encode("utf-8"),
        hashlib.sha512,
    ).hexdigest().upper()

    assert authnet_service._verify_webhook_signature(payload, expected_sig, sig_key) is True
    assert authnet_service._verify_webhook_signature(payload, "INVALIDSIGNATURE", sig_key) is False


# ── Test: Full Flow ───────────────────────────────


@pytest.mark.asyncio
@patch("app.integrations.authnet_service.ARBCreateSubscriptionController")
@patch("app.integrations.authnet_service.createTransactionController")
@patch("app.integrations.authnet_service.createCustomerPaymentProfileController")
@patch("app.integrations.authnet_service.createCustomerProfileController")
async def test_full_contract_to_payment_flow(
    mock_create_profile_cls,
    mock_add_payment_cls,
    mock_transaction_cls,
    mock_arb_cls,
    db, org, contact, contract,
):
    """
    Full Authorize.net flow:
    1. Connect credentials
    2. Create CIM customer
    3. Add payment profile
    4. Create ARB subscription
    5. Process successful payment webhook
    6. Process failed payment webhook
    7. Verify all records
    """
    # 1. Connect
    result = await authnet_service.connect_authnet(
        db, org.id,
        api_login_id="test_api_login",
        transaction_key="test_txn_key",
        signature_key="test_sig",
        environment="sandbox",
    )
    assert result["connected"] is True

    # 2. Create CIM customer
    mock_profile_resp = MagicMock()
    mock_profile_resp.messages.resultCode = "Ok"
    mock_profile_resp.customerProfileId = "12345"

    mock_profile_ctrl = MagicMock()
    mock_profile_ctrl.getresponse.return_value = mock_profile_resp
    mock_create_profile_cls.return_value = mock_profile_ctrl

    profile = await authnet_service.create_customer(db, org.id, contact.id)
    assert profile.external_customer_id == "12345"

    # 3. Add payment profile
    mock_pp_resp = MagicMock()
    mock_pp_resp.messages.resultCode = "Ok"
    mock_pp_resp.customerPaymentProfileId = "67890"

    mock_pp_ctrl = MagicMock()
    mock_pp_ctrl.getresponse.return_value = mock_pp_resp
    mock_add_payment_cls.return_value = mock_pp_ctrl

    profile = await authnet_service.add_payment_profile(
        db, org.id, contact.id,
        card_number="4111111111111111",
        expiration_date="2029-06",
        card_code="456",
    )
    assert profile.external_payment_id == "67890"
    assert profile.payment_method_last4 == "1111"

    # 4. Create ARB subscription
    mock_arb_resp = MagicMock()
    mock_arb_resp.messages.resultCode = "Ok"
    mock_arb_resp.subscriptionId = "11223"

    mock_arb_ctrl = MagicMock()
    mock_arb_ctrl.getresponse.return_value = mock_arb_resp
    mock_arb_cls.return_value = mock_arb_ctrl

    sub = await authnet_service.create_subscription(db, org.id, contract.id)
    assert sub.external_subscription_id == "11223"
    assert sub.status == "active"

    # Verify contract activated
    await db.refresh(contract)
    assert contract.status == "active"

    # 5. Process successful payment webhook
    success_payload = {
        "notificationId": "notif-full-001",
        "eventType": "net.authorize.payment.authcapture.created",
        "payload": {
            "id": "TXN-SUCCESS-1",
            "authAmount": 49.99,
            "customerProfile": {
                "customerProfileId": "12345",
            },
        },
    }
    wh_result = await authnet_service.process_webhook_event(
        db, success_payload, signature="", org_id=org.id
    )
    assert wh_result["status"] == "processed"

    # 6. Process failed payment webhook
    fail_payload = {
        "notificationId": "notif-full-002",
        "eventType": "net.authorize.payment.fraud.declined",
        "payload": {
            "id": "TXN-FAIL-1",
            "authAmount": 49.99,
            "customerProfile": {
                "customerProfileId": "12345",
            },
        },
    }
    wh_result2 = await authnet_service.process_webhook_event(
        db, fail_payload, signature="", org_id=org.id
    )
    assert wh_result2["status"] == "processed"

    # 7. Verify all records
    all_payments = (await db.execute(select(Payment))).scalars().all()
    assert len(all_payments) == 2  # 1 succeeded + 1 failed

    all_activities = (await db.execute(select(Activity))).scalars().all()
    # subscription_created + payment_succeeded + payment_failed
    assert len(all_activities) >= 3

    all_tasks = (await db.execute(select(Task))).scalars().all()
    assert len(all_tasks) == 1  # failed payment task

    all_logs = (await db.execute(select(PaymentWebhookLog))).scalars().all()
    assert len(all_logs) == 2

    # Verify contract is still active
    await db.refresh(contract)
    assert contract.status == "active"

    print("FULL AUTHNET FLOW TEST PASSED: Connect -> CIM Customer -> "
          "Payment Profile -> ARB Subscription -> Payment Succeeded -> Payment Failed")
