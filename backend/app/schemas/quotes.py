import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas.common import PaginationMeta


# ── Equipment Line ───────────────────────────────────

class EquipmentLine(BaseModel):
    product_name: str = Field(min_length=1, max_length=255)
    quantity: int = Field(ge=1, default=1)
    unit_price: float = Field(ge=0)
    total: float = Field(ge=0)


# ── Create / Update ──────────────────────────────────

class QuoteCreate(BaseModel):
    deal_id: uuid.UUID
    contact_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)
    equipment_lines: list[EquipmentLine] = Field(default_factory=list)
    equipment_total: float = Field(default=0, ge=0)
    monthly_monitoring_amount: float = Field(default=0, ge=0)
    contract_term_months: int = Field(default=36, ge=1)
    auto_renewal: bool = True
    total_contract_value: float = Field(default=0, ge=0)
    notes: str | None = None
    valid_until: datetime | None = None


class QuoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    equipment_lines: list[EquipmentLine] | None = None
    equipment_total: float | None = Field(default=None, ge=0)
    monthly_monitoring_amount: float | None = Field(default=None, ge=0)
    contract_term_months: int | None = Field(default=None, ge=1)
    auto_renewal: bool | None = None
    total_contract_value: float | None = Field(default=None, ge=0)
    notes: str | None = None
    valid_until: datetime | None = None


# ── Response ─────────────────────────────────────────

class QuoteResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    deal_id: uuid.UUID
    contact_id: uuid.UUID
    created_by: uuid.UUID | None
    title: str
    status: str
    equipment_lines: list[dict] | None
    equipment_total: float
    monthly_monitoring_amount: float
    contract_term_months: int
    auto_renewal: bool
    total_contract_value: float
    notes: str | None
    valid_until: datetime | None
    sent_at: datetime | None
    accepted_at: datetime | None
    pdf_url: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class QuoteListResponse(BaseModel):
    items: list[QuoteResponse]
    meta: PaginationMeta
