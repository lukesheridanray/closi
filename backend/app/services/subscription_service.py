"""
Subscription service -- CRUD for recurring billing subscriptions.
"""

import uuid
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subscription import Subscription
from app.schemas.subscriptions import (
    SubscriptionCreate,
    SubscriptionUpdate,
    SubscriptionResponse,
    SubscriptionListResponse,
)
from app.schemas.common import PaginationMeta


# ── List ─────────────────────────────────────────────


async def list_subscriptions(
    db: AsyncSession,
    org_id: uuid.UUID,
    *,
    contact_id: uuid.UUID | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> SubscriptionListResponse:
    base = select(Subscription).where(Subscription.organization_id == org_id)

    if contact_id:
        base = base.where(Subscription.contact_id == contact_id)
    if status:
        base = base.where(Subscription.status == status)

    count_q = select(func.count()).select_from(base.subquery())
    total_count = (await db.execute(count_q)).scalar_one()

    query = (
        base.order_by(Subscription.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    subs = result.scalars().all()

    total_pages = max(1, (total_count + page_size - 1) // page_size)

    return SubscriptionListResponse(
        items=[SubscriptionResponse.model_validate(s) for s in subs],
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total_count=total_count,
            total_pages=total_pages,
        ),
    )


# ── Get ──────────────────────────────────────────────


async def get_subscription(
    db: AsyncSession,
    org_id: uuid.UUID,
    subscription_id: uuid.UUID,
) -> Subscription:
    result = await db.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            Subscription.organization_id == org_id,
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise ValueError("Subscription not found.")
    return sub


# ── Create ───────────────────────────────────────────


async def create_subscription(
    db: AsyncSession,
    org_id: uuid.UUID,
    data: SubscriptionCreate,
) -> Subscription:
    sub = Subscription(
        organization_id=org_id,
        status="active",
        failed_payment_count=0,
        **data.model_dump(),
    )
    db.add(sub)
    await db.flush()
    return sub


# ── Update ───────────────────────────────────────────


async def update_subscription(
    db: AsyncSession,
    org_id: uuid.UUID,
    subscription_id: uuid.UUID,
    data: SubscriptionUpdate,
) -> Subscription:
    sub = await get_subscription(db, org_id, subscription_id)
    updates = data.model_dump(exclude_unset=True)

    # Handle cancellation
    if updates.get("status") == "cancelled" and sub.status != "cancelled":
        updates["cancelled_at"] = datetime.utcnow()

    for key, value in updates.items():
        setattr(sub, key, value)
    sub.updated_at = datetime.utcnow()
    await db.flush()
    return sub
