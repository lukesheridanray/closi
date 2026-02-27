import uuid
from datetime import datetime, date
from pydantic import BaseModel, Field

from app.schemas.common import PaginationMeta


# ── Create / Update ──────────────────────────────────

class SubscriptionCreate(BaseModel):
    contract_id: uuid.UUID | None = None
    contact_id: uuid.UUID
    provider_config_id: uuid.UUID | None = None
    customer_payment_profile_id: uuid.UUID | None = None
    amount: float = Field(ge=0)
    currency: str = Field(default="usd", max_length=10)
    billing_interval: str = Field(default="monthly", pattern="^(monthly|quarterly|annual)$")
    billing_interval_count: int = Field(default=1, ge=1)
    billing_anchor_day: int | None = Field(default=None, ge=1, le=28)
    next_billing_date: date | None = None


class SubscriptionUpdate(BaseModel):
    status: str | None = Field(default=None, pattern="^(active|past_due|cancelled|paused|expired)$")
    amount: float | None = Field(default=None, ge=0)
    cancellation_reason: str | None = None


# ── Response ─────────────────────────────────────────

class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    contract_id: uuid.UUID | None
    contact_id: uuid.UUID
    provider_config_id: uuid.UUID | None
    external_subscription_id: str | None
    status: str
    amount: float
    currency: str
    billing_interval: str
    billing_interval_count: int
    billing_anchor_day: int | None
    current_period_start: date | None
    current_period_end: date | None
    next_billing_date: date | None
    failed_payment_count: int
    last_payment_at: datetime | None
    cancelled_at: datetime | None
    cancellation_reason: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SubscriptionListResponse(BaseModel):
    items: list[SubscriptionResponse]
    meta: PaginationMeta
