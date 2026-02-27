import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import PaginationMeta


# ── Create / Update ──────────────────────────────────

class ContactCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    company: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=50)
    zip: str | None = Field(default=None, max_length=20)
    lead_source: str = Field(default="other", max_length=50)
    status: str = Field(default="new", max_length=50)
    property_type: str | None = Field(default=None, max_length=50)
    assigned_to: uuid.UUID | None = None
    tags: list[str] = Field(default_factory=list)
    notes: str | None = None


class ContactUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    company: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=50)
    zip: str | None = Field(default=None, max_length=20)
    lead_source: str | None = Field(default=None, max_length=50)
    status: str | None = Field(default=None, max_length=50)
    property_type: str | None = Field(default=None, max_length=50)
    assigned_to: uuid.UUID | None = None
    tags: list[str] | None = None
    notes: str | None = None


# ── Response ─────────────────────────────────────────

class ContactResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    first_name: str
    last_name: str
    email: str | None
    phone: str | None
    company: str | None
    address: str | None
    city: str | None
    state: str | None
    zip: str | None
    lead_source: str
    status: str
    property_type: str | None
    assigned_to: uuid.UUID | None
    tags: list[str]
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContactListResponse(BaseModel):
    items: list[ContactResponse]
    meta: PaginationMeta


# ── CSV Import ───────────────────────────────────────

class CSVImportRequest(BaseModel):
    """Payload for CSV contact import."""
    contacts: list[ContactCreate]
    duplicate_action: str = Field(default="skip", pattern="^(skip|update|create)$")
    lead_source_override: str | None = None
    assigned_to_override: uuid.UUID | None = None


class CSVImportResponse(BaseModel):
    imported: int
    updated: int
    skipped: int
    failed: int
    failed_rows: list[dict] = Field(default_factory=list)


class ImportTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    source_headers: list[str]
    column_mappings: list[dict]
    default_lead_source: str | None = None
    default_assigned_to: uuid.UUID | None = None
    settings: dict = Field(default_factory=dict)


class ImportTemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    source_headers: list[str] | None
    column_mappings: list[dict] | None
    default_lead_source: str | None
    default_assigned_to: uuid.UUID | None
    settings: dict | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
