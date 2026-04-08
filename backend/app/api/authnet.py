"""
Authorize.net integration API routes -- CIM customer management,
ARB subscriptions, one-time charges, reconciliation, and webhook handling.
"""

import uuid
from datetime import date, timedelta

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import AuthContext, require_roles, get_current_user
from app.middleware.tenant import get_current_org_id
from app.integrations import authnet_service

router = APIRouter(tags=["Authorize.net"])
_settings = get_settings()


# ── Schemas ─────────────────────────────────────────


class ConnectRequest(BaseModel):
    api_login_id: str
    transaction_key: str
    signature_key: str = ""
    environment: str = "sandbox"


class AuthnetStatusResponse(BaseModel):
    connected: bool
    provider_type: str = "authorize_net"
    display_name: str | None = None
    environment: str | None = None
    auto_invoice: bool | None = None
    retry_failed_days: int | None = None
    retry_max_attempts: int | None = None


class CreateCustomerRequest(BaseModel):
    contact_id: uuid.UUID


class AddPaymentProfileRequest(BaseModel):
    contact_id: uuid.UUID
    card_number: str
    expiration_date: str  # YYYY-MM
    card_code: str


class AddBankAccountRequest(BaseModel):
    contact_id: uuid.UUID
    routing_number: str = Field(pattern=r"^\d{9}$")
    account_number: str = Field(pattern=r"^\d{4,17}$")
    name_on_account: str = Field(min_length=1, max_length=100)
    account_type: Literal["checking", "savings", "businessChecking"] = "checking"
    echeck_type: Literal["WEB", "PPD", "CCD"] = "WEB"


class HostedProfilePageRequest(BaseModel):
    contact_id: uuid.UUID
    action: str = "manage"
    return_url: str | None = None


class CustomerProfileResponse(BaseModel):
    id: uuid.UUID
    contact_id: uuid.UUID
    external_customer_id: str | None
    external_payment_id: str | None = None
    payment_method_type: str | None = None
    payment_method_last4: str | None = None
    payment_method_brand: str | None = None
    payment_method_exp_month: int | None = None
    payment_method_exp_year: int | None = None
    is_default: bool = False
    status: str

    model_config = {"from_attributes": True}


class ChargeRequest(BaseModel):
    contact_id: uuid.UUID
    amount: float
    description: str = "One-time charge"
    contract_id: uuid.UUID | None = None


class CreateSubscriptionRequest(BaseModel):
    contract_id: uuid.UUID


class CancelSubscriptionRequest(BaseModel):
    subscription_id: uuid.UUID
    reason: str = "Cancelled by user"


class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    contract_id: uuid.UUID | None
    contact_id: uuid.UUID
    external_subscription_id: str | None
    status: str
    amount: float
    billing_interval: str

    model_config = {"from_attributes": True}


class WebhookLogResponse(BaseModel):
    id: uuid.UUID
    external_event_id: str | None
    event_type: str
    processing_status: str
    error_message: str | None
    received_at: str
    processed_at: str | None

    model_config = {"from_attributes": True}


class HostedProfilePageResponse(BaseModel):
    token: str
    url: str
    customer_profile_id: str
    environment: str


class ReconcileRequest(BaseModel):
    date_from: date | None = None
    date_to: date | None = None


# ── Connection Endpoints ───────────────────────────


@router.get("/integrations/authnet/status", response_model=AuthnetStatusResponse)
async def authnet_status(
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Get current Authorize.net connection status."""
    result = await authnet_service.get_authnet_status(db, org_id)
    return AuthnetStatusResponse(**result)


@router.post("/integrations/authnet/connect")
async def authnet_connect(
    data: ConnectRequest,
    auth: AuthContext = Depends(require_roles("owner")),
    db: AsyncSession = Depends(get_db),
):
    """Connect Authorize.net credentials to the organization."""
    try:
        result = await authnet_service.connect_authnet(
            db,
            auth.org_id,
            api_login_id=data.api_login_id,
            transaction_key=data.transaction_key,
            signature_key=data.signature_key,
            environment=data.environment,
        )
        await db.commit()
        return result
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/integrations/authnet/disconnect")
async def authnet_disconnect(
    auth: AuthContext = Depends(require_roles("owner")),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect Authorize.net from the organization."""
    await authnet_service.disconnect_authnet(db, auth.org_id)
    await db.commit()
    return {"status": "disconnected"}


# ── Customer Management (CIM) ─────────────────────


@router.post("/integrations/authnet/create-customer", response_model=CustomerProfileResponse)
async def create_customer(
    data: CreateCustomerRequest,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager", "sales_rep")),
    db: AsyncSession = Depends(get_db),
):
    """Create an Authorize.net CIM customer profile."""
    try:
        profile = await authnet_service.create_customer(db, auth.org_id, data.contact_id)
        await db.commit()
        return CustomerProfileResponse.model_validate(profile)
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/integrations/authnet/customer-profile/{contact_id}", response_model=CustomerProfileResponse)
async def get_customer_profile(
    contact_id: uuid.UUID,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager", "sales_rep")),
    db: AsyncSession = Depends(get_db),
):
    """Get the stored Authorize.net customer payment profile for a contact."""
    try:
        profile = await authnet_service.get_customer_profile(db, auth.org_id, contact_id)
        return CustomerProfileResponse.model_validate(profile)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/integrations/authnet/customer-profile/{contact_id}/sync", response_model=CustomerProfileResponse)
async def sync_customer_profile(
    contact_id: uuid.UUID,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager", "sales_rep")),
    db: AsyncSession = Depends(get_db),
):
    """Sync the stored profile against Authorize.net after a hosted card update."""
    try:
        profile = await authnet_service.sync_customer_profile(db, auth.org_id, contact_id)
        await db.commit()
        return CustomerProfileResponse.model_validate(profile)
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/integrations/authnet/hosted-profile-page", response_model=HostedProfilePageResponse)
async def create_hosted_profile_page(
    data: HostedProfilePageRequest,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager", "sales_rep")),
    db: AsyncSession = Depends(get_db),
):
    """Create an Accept Customer hosted page token for secure payment method updates."""
    try:
        result = await authnet_service.create_hosted_profile_page_token(
            db,
            auth.org_id,
            data.contact_id,
            action=data.action,
            return_url=data.return_url,
        )
        await db.commit()
        return HostedProfilePageResponse(**result)
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/integrations/authnet/add-payment-profile", response_model=CustomerProfileResponse)
async def add_payment_profile(
    data: AddPaymentProfileRequest,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager", "sales_rep")),
    db: AsyncSession = Depends(get_db),
):
    """Add a payment method (card) to an existing CIM customer."""
    try:
        profile = await authnet_service.add_payment_profile(
            db,
            auth.org_id,
            data.contact_id,
            card_number=data.card_number,
            expiration_date=data.expiration_date,
            card_code=data.card_code,
        )
        await db.commit()
        return CustomerProfileResponse.model_validate(profile)
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/integrations/authnet/add-bank-account", response_model=CustomerProfileResponse)
async def add_bank_account(
    data: AddBankAccountRequest,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager", "sales_rep")),
    db: AsyncSession = Depends(get_db),
):
    """Add a bank account (ACH/eCheck) to an existing CIM customer."""
    try:
        profile = await authnet_service.add_bank_account_profile(
            db,
            auth.org_id,
            data.contact_id,
            routing_number=data.routing_number,
            account_number=data.account_number,
            name_on_account=data.name_on_account,
            account_type=data.account_type,
            echeck_type=data.echeck_type,
        )
        await db.commit()
        return CustomerProfileResponse.model_validate(profile)
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── One-Time Charge ───────────────────────────────


@router.post("/integrations/authnet/charge")
async def charge_customer(
    data: ChargeRequest,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Create a one-time charge via CIM profile transaction."""
    try:
        payment = await authnet_service.charge_customer(
            db,
            auth.org_id,
            data.contact_id,
            amount=data.amount,
            description=data.description,
            contract_id=data.contract_id,
        )
        await db.commit()
        return {
            "payment_id": str(payment.id),
            "amount": float(payment.amount),
            "status": payment.status,
            "failure_code": payment.failure_code,
            "failure_message": payment.failure_message,
        }
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Subscriptions (ARB) ───────────────────────────


@router.post("/integrations/authnet/create-subscription", response_model=SubscriptionResponse)
async def create_subscription(
    data: CreateSubscriptionRequest,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Create an ARB subscription for a contract's recurring billing."""
    try:
        sub = await authnet_service.create_subscription(db, auth.org_id, data.contract_id)
        await db.commit()
        return SubscriptionResponse.model_validate(sub)
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/integrations/authnet/cancel-subscription")
async def cancel_subscription(
    data: CancelSubscriptionRequest,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Cancel an ARB subscription."""
    try:
        sub = await authnet_service.cancel_subscription(
            db, auth.org_id, data.subscription_id, reason=data.reason
        )
        await db.commit()
        return {"status": sub.status, "cancelled_at": str(sub.cancelled_at)}
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/integrations/authnet/subscription-status/{subscription_id}")
async def get_subscription_status(
    subscription_id: uuid.UUID,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Check ARB subscription status from Authorize.net."""
    try:
        result = await authnet_service.get_subscription_status(
            db, auth.org_id, subscription_id
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Reconciliation ──────────────────────────────────


@router.post("/integrations/authnet/reconcile")
async def reconcile_transactions(
    data: ReconcileRequest,
    auth: AuthContext = Depends(require_roles("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Reconcile local payment records against Authorize.net gateway.

    Compares transactions for the given date range. Defaults to last 7 days.
    Auto-corrects mismatches (gateway is source of truth).
    """
    date_to = data.date_to or date.today()
    date_from = data.date_from or (date_to - timedelta(days=7))

    try:
        report = await authnet_service.reconcile_transactions(
            db, auth.org_id, date_from, date_to
        )
        await db.commit()
        return report
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Webhook Logs ────────────────────────────────────


@router.get("/integrations/authnet/webhook-logs", response_model=list[WebhookLogResponse])
async def get_webhook_logs(
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Get recent Authorize.net webhook event logs."""
    logs = await authnet_service.list_webhook_logs(db, org_id)
    return [
        WebhookLogResponse(
            id=log.id,
            external_event_id=log.external_event_id,
            event_type=log.event_type,
            processing_status=log.processing_status,
            error_message=log.error_message,
            received_at=log.received_at.isoformat() if log.received_at else "",
            processed_at=log.processed_at.isoformat() if log.processed_at else None,
        )
        for log in logs
    ]


# ── Webhook Endpoint (no auth -- verified by signature) ──


@router.post("/webhooks/authnet")
async def authnet_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Authorize.net webhook endpoint. No JWT auth required.
    Verified by Authorize.net webhook signature.
    """
    payload = await request.json()
    signature = request.headers.get("X-ANET-Signature", "")

    try:
        result = await authnet_service.process_webhook_event(
            db, payload, signature
        )
        await db.commit()
        return result
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
