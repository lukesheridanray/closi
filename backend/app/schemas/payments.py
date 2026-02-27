import uuid
from datetime import datetime, date
from pydantic import BaseModel

from app.schemas.common import PaginationMeta


# ── Response ─────────────────────────────────────────

class PaymentResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    contact_id: uuid.UUID
    contract_id: uuid.UUID | None
    subscription_id: uuid.UUID | None
    invoice_id: uuid.UUID | None
    external_payment_id: str | None
    status: str
    amount: float
    amount_refunded: float
    currency: str
    payment_method_type: str | None
    payment_method_last4: str | None
    payment_date: date
    period_start: date | None
    period_end: date | None
    failure_code: str | None
    failure_message: str | None
    attempt_number: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PaymentListResponse(BaseModel):
    items: list[PaymentResponse]
    meta: PaginationMeta
