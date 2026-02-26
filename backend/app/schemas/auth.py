import uuid
from pydantic import BaseModel, EmailStr, Field


# ── Registration ──────────────────────────────────────

class RegisterRequest(BaseModel):
    """Step 1: Create account (email + password + name)."""
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)


class CompanyDetailsRequest(BaseModel):
    """Step 2: Fill in company details after account creation."""
    company_name: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    address_line1: str | None = Field(default=None, max_length=255)
    address_line2: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=50)
    zip: str | None = Field(default=None, max_length=20)
    timezone: str = Field(default="America/Chicago", max_length=50)


# ── Login ─────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ── Token Responses ───────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ── User Responses ────────────────────────────────────

class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    phone: str | None
    role: str
    avatar_url: str | None
    is_active: bool
    organization_id: uuid.UUID

    model_config = {"from_attributes": True}


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    email: str
    phone: str | None
    address_line1: str | None
    city: str | None
    state: str | None
    zip: str | None
    logo_url: str | None
    timezone: str
    currency: str
    plan: str

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    """Full response after login/register: tokens + user + org."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
    organization: OrganizationResponse


class MessageResponse(BaseModel):
    message: str
