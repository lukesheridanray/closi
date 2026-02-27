"""
Deals API routes -- CRUD, stage transitions.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import AuthContext, get_current_user
from app.middleware.tenant import get_current_org_id
from app.schemas.deals import (
    DealCreate,
    DealUpdate,
    DealStageUpdate,
    DealResponse,
    DealDetailResponse,
    DealListResponse,
    DealImportRequest,
    DealImportResponse,
)
from app.schemas.auth import MessageResponse
from app.services import deal_service

router = APIRouter(prefix="/deals", tags=["Deals"])


# ── List ─────────────────────────────────────────────


@router.get("", response_model=DealListResponse)
async def list_deals(
    pipeline_id: uuid.UUID | None = Query(default=None),
    stage_id: uuid.UUID | None = Query(default=None),
    assigned_to: uuid.UUID | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    return await deal_service.list_deals(
        db,
        org_id,
        pipeline_id=pipeline_id,
        stage_id=stage_id,
        assigned_to=assigned_to,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )


# ── CSV Import ───────────────────────────────────────


@router.post("/import", response_model=DealImportResponse)
async def import_deals(
    data: DealImportRequest,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await deal_service.import_deals(db, auth.org_id, auth.user_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Get ──────────────────────────────────────────────


@router.get("/{deal_id}", response_model=DealDetailResponse)
async def get_deal(
    deal_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await deal_service.get_deal_detail(db, org_id, deal_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Create ───────────────────────────────────────────


@router.post("", response_model=DealResponse, status_code=status.HTTP_201_CREATED)
async def create_deal(
    data: DealCreate,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        deal = await deal_service.create_deal(db, auth.org_id, auth.user_id, data)
        return DealResponse.model_validate(deal)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Update ───────────────────────────────────────────


@router.put("/{deal_id}", response_model=DealResponse)
async def update_deal(
    deal_id: uuid.UUID,
    data: DealUpdate,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        deal = await deal_service.update_deal(db, org_id, deal_id, data)
        return DealResponse.model_validate(deal)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Stage Move ───────────────────────────────────────


@router.patch("/{deal_id}/stage", response_model=DealResponse)
async def move_stage(
    deal_id: uuid.UUID,
    data: DealStageUpdate,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        deal = await deal_service.move_stage(db, auth.org_id, deal_id, auth.user_id, data)
        return DealResponse.model_validate(deal)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Delete ───────────────────────────────────────────


@router.delete("/{deal_id}", response_model=MessageResponse)
async def delete_deal(
    deal_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        await deal_service.delete_deal(db, org_id, deal_id)
        return MessageResponse(message="Deal deleted.")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
