"""
Activities API routes -- Listing and logging.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import AuthContext, get_current_user
from app.middleware.tenant import get_current_org_id
from app.schemas.activities import (
    ActivityCreate,
    ActivityResponse,
    ActivityListResponse,
)
from app.services import activity_service

router = APIRouter(prefix="/activities", tags=["Activities"])


# ── List ─────────────────────────────────────────────


@router.get("", response_model=ActivityListResponse)
async def list_activities(
    contact_id: uuid.UUID | None = Query(default=None),
    deal_id: uuid.UUID | None = Query(default=None),
    activity_type: str | None = Query(default=None, alias="type", max_length=50),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    return await activity_service.list_activities(
        db,
        org_id,
        contact_id=contact_id,
        deal_id=deal_id,
        activity_type=activity_type,
        page=page,
        page_size=page_size,
    )


# ── Create ───────────────────────────────────────────


@router.post("", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
async def create_activity(
    data: ActivityCreate,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        activity = await activity_service.create_activity(
            db, auth.org_id, auth.user_id, data
        )
        return ActivityResponse.model_validate(activity)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
