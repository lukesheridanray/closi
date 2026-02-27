import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas.common import PaginationMeta


# ── Create / Update ──────────────────────────────────

class ContractCreate(BaseModel):
    contact_id: uuid.UUID
    deal_id: uuid.UUID | None = None
    quote_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=255)
    monthly_amount: float = Field(ge=0)
    equipment_total: float = Field(default=0, ge=0)
    term_months: int = Field(default=36, ge=1)
    total_value: float = Field(default=0, ge=0)
    equipment_lines: list[dict] = Field(default_factory=list)
    start_date: datetime | None = None
    notes: str | None = None


class ContractUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    status: str | None = Field(default=None, pattern="^(pending|active|cancelled|expired)$")
    monthly_amount: float | None = Field(default=None, ge=0)
    notes: str | None = None
    cancellation_reason: str | None = None


# ── Response ─────────────────────────────────────────

class ContractResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    contact_id: uuid.UUID
    deal_id: uuid.UUID | None
    quote_id: uuid.UUID | None
    title: str
    status: str
    monthly_amount: float
    equipment_total: float
    term_months: int
    total_value: float
    equipment_lines: list[dict] | None
    start_date: datetime | None
    end_date: datetime | None
    signed_at: datetime | None
    cancelled_at: datetime | None
    cancellation_reason: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContractListResponse(BaseModel):
    items: list[ContractResponse]
    meta: PaginationMeta
