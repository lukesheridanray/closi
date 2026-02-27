"""
Subscription API routes -- List and manage recurring billing subscriptions.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import require_roles, AuthContext
from app.middleware.tenant import get_current_org_id
from app.schemas.subscriptions import (
    SubscriptionResponse,
    SubscriptionListResponse,
    SubscriptionUpdate,
)
from app.services import subscription_service

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


# ── List Subscriptions ──────────────────────────────


@router.get("", response_model=SubscriptionListResponse)
async def list_subscriptions(
    page: int = 1,
    page_size: int = 25,
    contact_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    return await subscription_service.list_subscriptions(
        db, org_id,
        contact_id=contact_id,
        status=status_filter,
        page=page,
        page_size=page_size,
    )


# ── Get Subscription ───────────────────────────────


@router.get("/{subscription_id}", response_model=SubscriptionResponse)
async def get_subscription(
    subscription_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        sub = await subscription_service.get_subscription(db, org_id, subscription_id)
        return SubscriptionResponse.model_validate(sub)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Update Subscription ────────────────────────────


@router.put("/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription(
    subscription_id: uuid.UUID,
    data: SubscriptionUpdate,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    try:
        sub = await subscription_service.update_subscription(
            db, auth.org_id, subscription_id, data
        )
        return SubscriptionResponse.model_validate(sub)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
