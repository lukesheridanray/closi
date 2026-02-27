"""
Pipeline API routes -- Pipeline listing, stage CRUD, reordering.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import require_roles, AuthContext
from app.middleware.tenant import get_current_org_id
from app.schemas.pipelines import (
    PipelineResponse,
    PipelineDetailResponse,
    StageCreate,
    StageUpdate,
    StageResponse,
    StageReorderRequest,
)
from app.schemas.auth import MessageResponse
from app.services import pipeline_service

router = APIRouter(prefix="/pipelines", tags=["Pipelines"])


# ── List Pipelines ───────────────────────────────────


@router.get("", response_model=list[PipelineDetailResponse])
async def list_pipelines(
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    return await pipeline_service.list_pipelines_with_stages(db, org_id)


# ── Get Stages ───────────────────────────────────────


@router.get("/{pipeline_id}/stages", response_model=list[StageResponse])
async def get_stages(
    pipeline_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    return await pipeline_service.get_stages(db, org_id, pipeline_id)


# ── Create Stage ─────────────────────────────────────


@router.post(
    "/{pipeline_id}/stages",
    response_model=StageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_stage(
    pipeline_id: uuid.UUID,
    data: StageCreate,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    try:
        stage = await pipeline_service.create_stage(db, auth.org_id, pipeline_id, data)
        return StageResponse.model_validate(stage)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Update Stage ─────────────────────────────────────


@router.put("/{pipeline_id}/stages/{stage_id}", response_model=StageResponse)
async def update_stage(
    pipeline_id: uuid.UUID,
    stage_id: uuid.UUID,
    data: StageUpdate,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    try:
        stage = await pipeline_service.update_stage(
            db, auth.org_id, pipeline_id, stage_id, data
        )
        return StageResponse.model_validate(stage)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Delete Stage ─────────────────────────────────────


@router.delete("/{pipeline_id}/stages/{stage_id}", response_model=MessageResponse)
async def delete_stage(
    pipeline_id: uuid.UUID,
    stage_id: uuid.UUID,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    try:
        await pipeline_service.delete_stage(db, auth.org_id, pipeline_id, stage_id)
        return MessageResponse(message="Stage deleted.")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Reorder Stages ───────────────────────────────────


@router.put("/{pipeline_id}/stages/reorder", response_model=list[StageResponse])
async def reorder_stages(
    pipeline_id: uuid.UUID,
    data: StageReorderRequest,
    auth: AuthContext = Depends(require_roles("owner", "admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await pipeline_service.reorder_stages(db, auth.org_id, pipeline_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
