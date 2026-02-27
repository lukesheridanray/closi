"""
Users API routes -- List, invite, update.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import AuthContext, require_roles
from app.middleware.tenant import get_current_org_id
from app.schemas.users import (
    UserInviteRequest,
    UserUpdate,
    UserResponse,
    UserListResponse,
)
from app.services import user_service

router = APIRouter(prefix="/users", tags=["Users"])


# ── List ─────────────────────────────────────────────


@router.get("", response_model=UserListResponse)
async def list_users(
    auth: AuthContext = Depends(require_roles("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.list_users(db, auth.org_id)


# ── Invite ───────────────────────────────────────────


@router.post("/invite", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def invite_user(
    data: UserInviteRequest,
    auth: AuthContext = Depends(require_roles("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await user_service.invite_user(db, auth.org_id, data)
        return UserResponse.model_validate(user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Update ───────────────────────────────────────────


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    auth: AuthContext = Depends(require_roles("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await user_service.update_user(db, auth.org_id, user_id, data)
        return UserResponse.model_validate(user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
