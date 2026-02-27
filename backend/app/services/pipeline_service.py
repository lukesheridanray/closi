"""
Pipeline service -- Pipeline/stage CRUD, reordering.
"""

import uuid
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pipeline import Pipeline, PipelineStage
from app.models.deal import Deal
from app.schemas.pipelines import (
    PipelineResponse,
    PipelineDetailResponse,
    StageCreate,
    StageUpdate,
    StageResponse,
    StageReorderRequest,
)


# ── List Pipelines ───────────────────────────────────


async def list_pipelines(
    db: AsyncSession,
    org_id: uuid.UUID,
) -> list[PipelineResponse]:
    result = await db.execute(
        select(Pipeline)
        .where(Pipeline.organization_id == org_id)
        .order_by(Pipeline.sort_order.asc())
    )
    pipelines = result.scalars().all()
    return [PipelineResponse.model_validate(p) for p in pipelines]


async def list_pipelines_with_stages(
    db: AsyncSession,
    org_id: uuid.UUID,
) -> list[PipelineDetailResponse]:
    result = await db.execute(
        select(Pipeline)
        .where(Pipeline.organization_id == org_id)
        .order_by(Pipeline.sort_order.asc())
    )
    pipelines = result.scalars().all()

    details = []
    for p in pipelines:
        stages_result = await db.execute(
            select(PipelineStage)
            .where(
                PipelineStage.pipeline_id == p.id,
                PipelineStage.organization_id == org_id,
            )
            .order_by(PipelineStage.sort_order.asc())
        )
        stages = stages_result.scalars().all()
        data = PipelineResponse.model_validate(p).model_dump()
        data["stages"] = [StageResponse.model_validate(s) for s in stages]
        details.append(PipelineDetailResponse(**data))
    return details


# ── Get Pipeline with Stages ─────────────────────────


async def get_pipeline_detail(
    db: AsyncSession,
    org_id: uuid.UUID,
    pipeline_id: uuid.UUID,
) -> PipelineDetailResponse:
    result = await db.execute(
        select(Pipeline).where(
            Pipeline.id == pipeline_id,
            Pipeline.organization_id == org_id,
        )
    )
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise ValueError("Pipeline not found.")

    stages_result = await db.execute(
        select(PipelineStage)
        .where(
            PipelineStage.pipeline_id == pipeline_id,
            PipelineStage.organization_id == org_id,
        )
        .order_by(PipelineStage.sort_order.asc())
    )
    stages = stages_result.scalars().all()

    data = PipelineResponse.model_validate(pipeline).model_dump()
    data["stages"] = [StageResponse.model_validate(s) for s in stages]
    return PipelineDetailResponse(**data)


# ── Get Stages ───────────────────────────────────────


async def get_stages(
    db: AsyncSession,
    org_id: uuid.UUID,
    pipeline_id: uuid.UUID,
) -> list[StageResponse]:
    result = await db.execute(
        select(PipelineStage)
        .where(
            PipelineStage.pipeline_id == pipeline_id,
            PipelineStage.organization_id == org_id,
        )
        .order_by(PipelineStage.sort_order.asc())
    )
    stages = result.scalars().all()
    return [StageResponse.model_validate(s) for s in stages]


# ── Create Stage ─────────────────────────────────────


async def create_stage(
    db: AsyncSession,
    org_id: uuid.UUID,
    pipeline_id: uuid.UUID,
    data: StageCreate,
) -> PipelineStage:
    # Get max sort_order
    max_result = await db.execute(
        select(func.max(PipelineStage.sort_order)).where(
            PipelineStage.pipeline_id == pipeline_id,
            PipelineStage.organization_id == org_id,
        )
    )
    max_order = max_result.scalar_one() or 0

    stage = PipelineStage(
        organization_id=org_id,
        pipeline_id=pipeline_id,
        sort_order=max_order + 1,
        **data.model_dump(),
    )
    db.add(stage)
    await db.flush()
    return stage


# ── Update Stage ─────────────────────────────────────


async def update_stage(
    db: AsyncSession,
    org_id: uuid.UUID,
    pipeline_id: uuid.UUID,
    stage_id: uuid.UUID,
    data: StageUpdate,
) -> PipelineStage:
    result = await db.execute(
        select(PipelineStage).where(
            PipelineStage.id == stage_id,
            PipelineStage.pipeline_id == pipeline_id,
            PipelineStage.organization_id == org_id,
        )
    )
    stage = result.scalar_one_or_none()
    if not stage:
        raise ValueError("Stage not found.")

    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(stage, key, value)
    await db.flush()
    return stage


# ── Delete Stage ─────────────────────────────────────


async def delete_stage(
    db: AsyncSession,
    org_id: uuid.UUID,
    pipeline_id: uuid.UUID,
    stage_id: uuid.UUID,
) -> None:
    result = await db.execute(
        select(PipelineStage).where(
            PipelineStage.id == stage_id,
            PipelineStage.pipeline_id == pipeline_id,
            PipelineStage.organization_id == org_id,
        )
    )
    stage = result.scalar_one_or_none()
    if not stage:
        raise ValueError("Stage not found.")

    # Check for existing deals in this stage
    deal_count_result = await db.execute(
        select(func.count()).where(
            Deal.stage_id == stage_id,
            Deal.organization_id == org_id,
            Deal.is_deleted == False,  # noqa: E712
        )
    )
    deal_count = deal_count_result.scalar_one()
    if deal_count > 0:
        raise ValueError(
            f"Cannot delete stage with {deal_count} active deal(s). "
            "Move or delete deals first."
        )

    await db.delete(stage)
    await db.flush()


# ── Reorder Stages ───────────────────────────────────


async def reorder_stages(
    db: AsyncSession,
    org_id: uuid.UUID,
    pipeline_id: uuid.UUID,
    data: StageReorderRequest,
) -> list[StageResponse]:
    for idx, stage_id in enumerate(data.ordered_ids):
        result = await db.execute(
            select(PipelineStage).where(
                PipelineStage.id == stage_id,
                PipelineStage.pipeline_id == pipeline_id,
                PipelineStage.organization_id == org_id,
            )
        )
        stage = result.scalar_one_or_none()
        if not stage:
            raise ValueError(f"Stage {stage_id} not found in pipeline.")
        stage.sort_order = idx

    await db.flush()
    return await get_stages(db, org_id, pipeline_id)
