"""
Stripe integration API routes -- Connect OAuth, customer management,
subscriptions, payment setup, and webhook handling.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import AuthContext, require_roles, get_current_user
from app.middleware.tenant import get_current_org_id
from app.integrations import stripe_service

router = APIRouter(tags=["Stripe"])
_settings = get_settings()


# ── Schemas ─────────────────────────────────────────


class ConnectResponse(BaseModel):
    url: str


class StatusResponse(BaseModel):
    connected: bool
    account_id: str | None = None
    onboarding_complete: bool = False
    charges_enabled: bool = False
    business_name: str | None = None
    environment: str | None = None
    error: str | None = None


class SetupIntentRequest(BaseModel):
    contact_id: uuid.UUID


class SetupIntentResponse(BaseModel):
    client_secret: str
    setup_intent_id: str
    customer_id: str
    stripe_account_id: str


class AttachPaymentMethodRequest(BaseModel):
    contact_id: uuid.UUID
    payment_method_id: str


class PaymentProfileResponse(BaseModel):
    id: uuid.UUID
    contact_id: uuid.UUID
    external_customer_id: str | None
    payment_method_type: str | None
    payment_method_last4: str | None
    payment_method_brand: str | None
    payment_method_exp_month: int | None
    payment_method_exp_year: int | None
    is_default: bool
    status: str

    model_config = {"from_attributes": True}


class CreateSubscriptionRequest(BaseModel):
    contract_id: uuid.UUID


class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    contract_id: uuid.UUID | None
    contact_id: uuid.UUID
    external_subscription_id: str | None
    status: str
    amount: float
    billing_interval: str

    model_config = {"from_attributes": True}


class ChargeEquipmentRequest(BaseModel):
    contract_id: uuid.UUID


class WebhookLogResponse(BaseModel):
    id: uuid.UUID
    external_event_id: str | None
    event_type: str
    processing_status: str
    error_message: str | None
    received_at: str
    processed_at: str | None

    model_config = {"from_attributes": True}


# ── Config (public key for frontend) ────────────────


@router.get("/integrations/stripe/config")
async def stripe_config(
    _: AuthContext = Depends(get_current_user),
):
    """Return the Stripe publishable key for the frontend."""
    return {
        "publishable_key": _settings.stripe_publishable_key,
    }


# ── Connect Endpoints ───────────────────────────────


@router.get("/integrations/stripe/connect", response_model=ConnectResponse)
async def stripe_connect(
    auth: AuthContext = Depends(require_roles("owner")),
    db: AsyncSession = Depends(get_db),
):
    """Initiate Stripe Connect onboarding. Returns the onboarding URL."""
    try:
        url = await stripe_service.create_connect_account(db, auth.org_id)
        return ConnectResponse(url=url)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/integrations/stripe/callback")
async def stripe_callback(
    auth: AuthContext = Depends(require_roles("owner")),
    db: AsyncSession = Depends(get_db),
):
    """Called after Stripe onboarding completes. Checks account status."""
    try:
        result = await stripe_service.complete_onboarding(db, auth.org_id)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/integrations/stripe/status", response_model=StatusResponse)
async def stripe_status(
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Get current Stripe connection status."""
    result = await stripe_service.get_stripe_status(db, org_id)
    return StatusResponse(**result)


@router.delete("/integrations/stripe/disconnect")
async def stripe_disconnect(
    auth: AuthContext = Depends(require_roles("owner")),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect Stripe from the organization."""
    await stripe_service.disconnect_stripe(db, auth.org_id)
    return {"status": "disconnected"}


@router.get("/integrations/stripe/dashboard-link")
async def stripe_dashboard_link(
    auth: AuthContext = Depends(require_roles("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get a Stripe Express dashboard login link."""
    try:
        url = await stripe_service.create_dashboard_login_link(db, auth.org_id)
        return {"url": url}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Customer + Payment Method ───────────────────────


@router.post("/integrations/stripe/setup-intent", response_model=SetupIntentResponse)
async def create_setup_intent(
    data: SetupIntentRequest,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager", "sales_rep")),
    db: AsyncSession = Depends(get_db),
):
    """Create a SetupIntent for collecting a customer's payment method."""
    try:
        result = await stripe_service.create_setup_intent(db, auth.org_id, data.contact_id)
        return SetupIntentResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/integrations/stripe/attach-payment-method", response_model=PaymentProfileResponse)
async def attach_payment_method(
    data: AttachPaymentMethodRequest,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager", "sales_rep")),
    db: AsyncSession = Depends(get_db),
):
    """Attach a confirmed payment method to a customer profile."""
    try:
        profile = await stripe_service.attach_payment_method(
            db, auth.org_id, data.contact_id, data.payment_method_id
        )
        return PaymentProfileResponse.model_validate(profile)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Subscriptions ───────────────────────────────────


@router.post("/integrations/stripe/create-subscription", response_model=SubscriptionResponse)
async def create_subscription(
    data: CreateSubscriptionRequest,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe subscription for a contract's recurring billing."""
    try:
        sub = await stripe_service.create_subscription(db, auth.org_id, data.contract_id)
        return SubscriptionResponse.model_validate(sub)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/integrations/stripe/charge-equipment")
async def charge_equipment(
    data: ChargeEquipmentRequest,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Charge a one-time equipment fee on a contract."""
    try:
        payment = await stripe_service.create_one_time_charge(db, auth.org_id, data.contract_id)
        return {
            "payment_id": str(payment.id),
            "amount": float(payment.amount),
            "status": payment.status,
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Webhook Logs ────────────────────────────────────


@router.get("/integrations/stripe/webhook-logs", response_model=list[WebhookLogResponse])
async def get_webhook_logs(
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Get recent Stripe webhook event logs."""
    logs = await stripe_service.list_webhook_logs(db, org_id)
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


# ── Webhook Endpoint (no auth -- verified by Stripe signature) ──


@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Stripe webhook endpoint. No JWT auth required.
    Verified by Stripe webhook signature.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not sig_header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Stripe signature header.",
        )

    try:
        result = await stripe_service.process_webhook_event(db, payload, sig_header)
        return result
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
