"""
JWT authentication dependency for FastAPI.

Extracts and validates Bearer tokens from the Authorization header,
returning the authenticated user's context for downstream handlers.
"""

import uuid
from dataclasses import dataclass
from typing import Annotated, Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import get_settings

settings = get_settings()
_bearer_scheme = HTTPBearer()


# ── Authenticated User Context ───────────────────────


@dataclass(frozen=True)
class AuthContext:
    """Immutable context extracted from a verified JWT."""

    user_id: uuid.UUID
    org_id: uuid.UUID
    role: str
    email: str


# ── Core Dependency ──────────────────────────────────


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer_scheme)],
) -> AuthContext:
    """
    FastAPI dependency that extracts and verifies the JWT from the
    Authorization: Bearer <token> header.

    Returns an AuthContext on success; raises HTTP 401 otherwise.
    """
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Pull required claims
    sub: str | None = payload.get("sub")
    org: str | None = payload.get("org")
    role: str | None = payload.get("role")
    email: str | None = payload.get("email")

    if not all([sub, org, role, email]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing required claims.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = uuid.UUID(sub)
        org_id = uuid.UUID(org)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token contains malformed identifiers.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return AuthContext(user_id=user_id, org_id=org_id, role=role, email=email)


# ── Role-Gated Dependency Factory ────────────────────


def require_roles(*roles: str) -> Callable:
    """
    Returns a FastAPI dependency that first authenticates the user and
    then verifies their role is in the allowed set.

    Usage::

        @router.put("/admin-thing")
        async def admin_thing(
            auth: AuthContext = Depends(require_roles("owner", "admin")),
        ):
            ...
    """
    allowed = set(roles)

    async def _check_role(
        auth: Annotated[AuthContext, Depends(get_current_user)],
    ) -> AuthContext:
        if auth.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of the following roles: {', '.join(sorted(allowed))}.",
            )
        return auth

    return _check_role
