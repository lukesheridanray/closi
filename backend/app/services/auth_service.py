import re
import uuid
from datetime import datetime, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest,
    CompanyDetailsRequest,
    LoginRequest,
    AuthResponse,
    TokenResponse,
    UserResponse,
    OrganizationResponse,
)

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password Helpers ──────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# ── Slug Generation ───────────────────────────────────

def generate_slug(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    slug = slug.strip("-")
    return slug or "org"


# ── JWT Helpers ───────────────────────────────────────

def create_access_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "org": str(user.organization_id),
        "role": user.role,
        "email": user.email,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow()
        + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "type": "refresh",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow()
        + timedelta(days=settings.refresh_token_expire_days),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises JWTError on failure."""
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])


# ── Service Methods ───────────────────────────────────

async def register(db: AsyncSession, data: RegisterRequest) -> AuthResponse:
    """Create a new organization and owner user."""
    # Check for existing email
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise ValueError("A user with this email already exists.")

    # Create organization with placeholder name (completed in company details step)
    org = Organization(
        name=f"{data.first_name}'s Organization",
        slug=generate_slug(f"{data.first_name}-{data.last_name}-{uuid.uuid4().hex[:6]}"),
        email=data.email,
    )
    db.add(org)
    await db.flush()

    # Create owner user
    user = User(
        organization_id=org.id,
        email=data.email,
        password_hash=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role="owner",
        is_active=True,
    )
    db.add(user)
    await db.flush()

    # Generate tokens
    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user)

    # Store refresh token
    user.refresh_token = refresh_token
    user.last_login_at = datetime.utcnow()
    await db.flush()

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
        organization=OrganizationResponse.model_validate(org),
    )


async def update_company_details(
    db: AsyncSession, org_id: uuid.UUID, data: CompanyDetailsRequest
) -> OrganizationResponse:
    """Update organization details after registration."""
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise ValueError("Organization not found.")

    org.name = data.company_name
    org.slug = generate_slug(data.company_name)
    org.phone = data.phone
    org.address_line1 = data.address_line1
    org.address_line2 = data.address_line2
    org.city = data.city
    org.state = data.state
    org.zip = data.zip
    org.timezone = data.timezone
    org.updated_at = datetime.utcnow()
    await db.flush()

    return OrganizationResponse.model_validate(org)


async def login(db: AsyncSession, data: LoginRequest) -> AuthResponse:
    """Authenticate user and return tokens."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise ValueError("Invalid email or password.")

    if not user.is_active:
        raise ValueError("This account has been deactivated.")

    # Generate tokens
    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user)

    # Rotate refresh token
    user.refresh_token = refresh_token
    user.last_login_at = datetime.utcnow()
    await db.flush()

    # Load organization
    org_result = await db.execute(
        select(Organization).where(Organization.id == user.organization_id)
    )
    org = org_result.scalar_one()

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
        organization=OrganizationResponse.model_validate(org),
    )


async def refresh_tokens(db: AsyncSession, refresh_token_str: str) -> TokenResponse:
    """Validate refresh token and issue new token pair."""
    try:
        payload = decode_token(refresh_token_str)
    except JWTError:
        raise ValueError("Invalid or expired refresh token.")

    if payload.get("type") != "refresh":
        raise ValueError("Invalid token type.")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user or user.refresh_token != refresh_token_str:
        raise ValueError("Invalid refresh token.")

    if not user.is_active:
        raise ValueError("This account has been deactivated.")

    # Rotate tokens
    new_access = create_access_token(user)
    new_refresh = create_refresh_token(user)
    user.refresh_token = new_refresh
    await db.flush()

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)


async def logout(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Invalidate refresh token."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user:
        user.refresh_token = None
        await db.flush()


async def get_current_user(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    """Fetch a user by ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
