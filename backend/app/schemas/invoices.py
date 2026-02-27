import uuid
from datetime import datetime, date
from pydantic import BaseModel, Field

from app.schemas.common import PaginationMeta


# ── Line Item ────────────────────────────────────────

class InvoiceLineItem(BaseModel):
    description: str = Field(min_length=1, max_length=255)
    quantity: int = Field(ge=1, default=1)
    unit_price: float = Field(ge=0)
    amount: float = Field(ge=0)


# ── Create / Update ──────────────────────────────────

class InvoiceCreate(BaseModel):
    contact_id: uuid.UUID
    contract_id: uuid.UUID | None = None
    subscription_id: uuid.UUID | None = None
    invoice_number: str = Field(min_length=1, max_length=50)
    invoice_date: date
    due_date: date
    period_start: date | None = None
    period_end: date | None = None
    line_items: list[InvoiceLineItem] = Field(default_factory=list)
    subtotal: float = Field(default=0, ge=0)
    tax_amount: float = Field(default=0, ge=0)
    total: float = Field(default=0, ge=0)
    amount_due: float = Field(default=0, ge=0)
    currency: str = Field(default="usd", max_length=10)
    memo: str | None = None


class InvoiceUpdate(BaseModel):
    status: str | None = Field(
        default=None,
        pattern="^(draft|sent|paid|past_due|void|uncollectible)$",
    )
    due_date: date | None = None
    line_items: list[InvoiceLineItem] | None = None
    subtotal: float | None = Field(default=None, ge=0)
    tax_amount: float | None = Field(default=None, ge=0)
    total: float | None = Field(default=None, ge=0)
    amount_due: float | None = Field(default=None, ge=0)
    memo: str | None = None


# ── Response ─────────────────────────────────────────

class InvoiceResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    contact_id: uuid.UUID
    contract_id: uuid.UUID | None
    subscription_id: uuid.UUID | None
    external_invoice_id: str | None
    invoice_number: str
    status: str
    invoice_date: date
    due_date: date
    period_start: date | None
    period_end: date | None
    subtotal: float
    tax_amount: float
    total: float
    amount_paid: float
    amount_due: float
    currency: str
    memo: str | None
    line_items: list[dict] | None
    pdf_url: str | None
    sent_at: datetime | None
    paid_at: datetime | None
    voided_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvoiceListResponse(BaseModel):
    items: list[InvoiceResponse]
    meta: PaginationMeta
