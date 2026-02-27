import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas.common import PaginationMeta


# ── Create / Update ──────────────────────────────────

class DealCreate(BaseModel):
    contact_id: uuid.UUID
    pipeline_id: uuid.UUID
    stage_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)
    estimated_value: float = Field(default=0, ge=0)
    assigned_to: uuid.UUID | None = None
    notes: str | None = None
    expected_close_date: datetime | None = None


class DealUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    estimated_value: float | None = Field(default=None, ge=0)
    assigned_to: uuid.UUID | None = None
    notes: str | None = None
    expected_close_date: datetime | None = None
    loss_reason: str | None = None


class DealStageUpdate(BaseModel):
    stage_id: uuid.UUID


# ── Response ─────────────────────────────────────────

class DealResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    contact_id: uuid.UUID
    pipeline_id: uuid.UUID
    stage_id: uuid.UUID | None
    assigned_to: uuid.UUID | None
    title: str
    estimated_value: float
    notes: str | None
    loss_reason: str | None
    expected_close_date: datetime | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DealDetailResponse(DealResponse):
    """Extended with nested relations for detail view."""
    contact_name: str | None = None
    stage_name: str | None = None
    assigned_user_name: str | None = None


class DealListResponse(BaseModel):
    items: list[DealResponse]
    meta: PaginationMeta


# ── CSV Import ──────────────────────────────────────

class DealImportRow(BaseModel):
    """Single row in the deal CSV import."""
    # Contact fields
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    company: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    zip: str | None = None
    lead_source: str | None = None
    # Deal fields
    title: str = Field(min_length=1, max_length=255)
    estimated_value: float | None = None
    notes: str | None = None
    expected_close_date: str | None = None


class DealImportRequest(BaseModel):
    rows: list[DealImportRow]
    pipeline_id: uuid.UUID
    stage_id: uuid.UUID
    assigned_to_override: uuid.UUID | None = None
    lead_source_override: str | None = None
    duplicate_action: str = Field(default="skip", pattern="^(skip|create)$")


class DealImportResponse(BaseModel):
    imported: int
    skipped: int
    failed: int
    contacts_created: int
    contacts_matched: int
    failed_rows: list[dict] = []
