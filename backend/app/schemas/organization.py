import uuid
from datetime import datetime
from pydantic import BaseModel, Field


# ── Update ───────────────────────────────────────────

class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    address_line1: str | None = Field(default=None, max_length=255)
    address_line2: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=50)
    zip: str | None = Field(default=None, max_length=20)
    logo_url: str | None = Field(default=None, max_length=500)
    timezone: str | None = Field(default=None, max_length=50)
    settings: dict | None = None


# ── Response ─────────────────────────────────────────

class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    email: str
    phone: str | None
    address_line1: str | None
    address_line2: str | None
    city: str | None
    state: str | None
    zip: str | None
    logo_url: str | None
    timezone: str
    currency: str
    plan: str
    settings: dict | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
