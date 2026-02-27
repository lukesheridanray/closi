"""
Activity service -- Activity logging and listing.
"""

import uuid
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.schemas.activities import (
    ActivityCreate,
    ActivityResponse,
    ActivityListResponse,
)
from app.schemas.common import PaginationMeta


# ── List ─────────────────────────────────────────────


async def list_activities(
    db: AsyncSession,
    org_id: uuid.UUID,
    *,
    contact_id: uuid.UUID | None = None,
    deal_id: uuid.UUID | None = None,
    activity_type: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> ActivityListResponse:
    base = select(Activity).where(Activity.organization_id == org_id)

    if contact_id:
        base = base.where(Activity.contact_id == contact_id)
    if deal_id:
        base = base.where(Activity.deal_id == deal_id)
    if activity_type:
        base = base.where(Activity.type == activity_type)

    count_q = select(func.count()).select_from(base.subquery())
    total_count = (await db.execute(count_q)).scalar_one()

    query = (
        base.order_by(Activity.performed_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    activities = result.scalars().all()

    total_pages = max(1, (total_count + page_size - 1) // page_size)

    return ActivityListResponse(
        items=[ActivityResponse.model_validate(a) for a in activities],
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total_count=total_count,
            total_pages=total_pages,
        ),
    )


# ── Create ───────────────────────────────────────────


async def create_activity(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    data: ActivityCreate,
) -> Activity:
    activity = Activity(
        organization_id=org_id,
        performed_by=user_id,
        performed_at=datetime.utcnow(),
        **data.model_dump(),
    )
    db.add(activity)
    await db.flush()
    return activity
