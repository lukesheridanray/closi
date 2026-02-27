import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


# ── Create (invite) / Update ────────────────────────

class UserInviteRequest(BaseModel):
    email: EmailStr
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    role: str = Field(default="sales_rep", pattern="^(owner|admin|manager|sales_rep|technician)$")


class UserUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    role: str | None = Field(default=None, pattern="^(owner|admin|manager|sales_rep|technician)$")
    is_active: bool | None = None


# ── Response ─────────────────────────────────────────

class UserResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    phone: str | None
    role: str
    avatar_url: str | None
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    items: list[UserResponse]
