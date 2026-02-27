import uuid
from datetime import datetime
from pydantic import BaseModel, Field


# ── Pipeline ─────────────────────────────────────────

class PipelineResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    is_default: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Pipeline Stage ───────────────────────────────────

class StageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(default="#6C63FF", max_length=20)
    is_won_stage: bool = False
    is_lost_stage: bool = False
    stale_days: int | None = None
    is_active: bool = True


class StageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, max_length=20)
    stale_days: int | None = None
    is_active: bool | None = None


class StageResponse(BaseModel):
    id: uuid.UUID
    pipeline_id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    color: str
    sort_order: int
    is_won_stage: bool
    is_lost_stage: bool
    stale_days: int | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class StageReorderRequest(BaseModel):
    ordered_ids: list[uuid.UUID]


class PipelineDetailResponse(PipelineResponse):
    stages: list[StageResponse] = []


# ── Stage History ────────────────────────────────────

class StageHistoryResponse(BaseModel):
    id: uuid.UUID
    deal_id: uuid.UUID
    from_stage_id: uuid.UUID | None
    to_stage_id: uuid.UUID | None
    moved_by: uuid.UUID | None
    moved_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
