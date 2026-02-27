"""
User service -- User management, invites.
"""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.auth_service import hash_password
from app.schemas.users import (
    UserInviteRequest,
    UserUpdate,
    UserResponse,
    UserListResponse,
)


# ── List ─────────────────────────────────────────────


async def list_users(
    db: AsyncSession,
    org_id: uuid.UUID,
) -> UserListResponse:
    result = await db.execute(
        select(User)
        .where(User.organization_id == org_id)
        .order_by(User.created_at.asc())
    )
    users = result.scalars().all()
    return UserListResponse(
        items=[UserResponse.model_validate(u) for u in users],
    )


# ── Invite ───────────────────────────────────────────


async def invite_user(
    db: AsyncSession,
    org_id: uuid.UUID,
    data: UserInviteRequest,
) -> User:
    # Check if email already exists
    existing = await db.execute(
        select(User).where(User.email == data.email)
    )
    if existing.scalar_one_or_none():
        raise ValueError("A user with this email already exists.")

    # Create user with a temporary random password
    # The invited user will set their password on first login via password reset
    temp_password = uuid.uuid4().hex
    user = User(
        organization_id=org_id,
        email=data.email,
        password_hash=hash_password(temp_password),
        first_name=data.first_name,
        last_name=data.last_name,
        role=data.role,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    # TODO: Send invite email via notification_service
    return user


# ── Update ───────────────────────────────────────────


async def update_user(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    data: UserUpdate,
) -> User:
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.organization_id == org_id,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError("User not found.")

    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(user, key, value)
    user.updated_at = datetime.utcnow()
    await db.flush()
    return user
