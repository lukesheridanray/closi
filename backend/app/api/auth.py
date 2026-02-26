"""
Auth API routes -- registration, login, token refresh, logout,
company details, and current-user info.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import AuthContext, get_current_user, require_roles
from app.schemas.auth import (
    AuthResponse,
    CompanyDetailsRequest,
    LoginRequest,
    MessageResponse,
    OrganizationResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


# ── Public Endpoints ─────────────────────────────────


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create a new account and organization."""
    try:
        return await auth_service.register(db, data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/login", response_model=AuthResponse)
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate with email and password."""
    try:
        return await auth_service.login(db, data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange a valid refresh token for a new token pair."""
    try:
        return await auth_service.refresh_tokens(db, data.refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Protected Endpoints ──────────────────────────────


@router.post("/logout", response_model=MessageResponse)
async def logout(
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invalidate the current refresh token."""
    try:
        await auth_service.logout(db, auth.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return MessageResponse(message="Successfully logged out.")


@router.put("/company-details", response_model=OrganizationResponse)
async def update_company_details(
    data: CompanyDetailsRequest,
    auth: AuthContext = Depends(require_roles("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update organization details (owner/admin only)."""
    try:
        return await auth_service.update_company_details(db, auth.org_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/me", response_model=AuthResponse)
async def me(
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user and organization info.

    Re-uses the existing access token from the request rather than
    issuing new tokens so that the caller can cache its token normally.
    """
    user = await auth_service.get_current_user(db, auth.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists.",
        )

    org = user.organization

    # Re-use the existing tokens that the client already holds.
    # We don't have the raw refresh token here, so we read it from the
    # user record (it's the most recently issued one).
    return AuthResponse(
        access_token="",  # Client should keep its current access token
        refresh_token="",  # Client should keep its current refresh token
        user=UserResponse.model_validate(user),
        organization=OrganizationResponse.model_validate(org),
    )
