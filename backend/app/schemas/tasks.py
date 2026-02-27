import uuid
from datetime import datetime, date, time
from pydantic import BaseModel, Field

from app.schemas.common import PaginationMeta


# ── Create / Update ──────────────────────────────────

class TaskCreate(BaseModel):
    contact_id: uuid.UUID | None = None
    deal_id: uuid.UUID | None = None
    assigned_to: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    priority: str = Field(default="medium", pattern="^(low|medium|high|urgent)$")
    type: str = Field(default="follow_up", pattern="^(call|email|meeting|site_visit|install|follow_up|other)$")
    due_date: date | None = None
    due_time: time | None = None
    duration_minutes: int | None = None
    is_all_day: bool = True
    recurrence: str = Field(default="none", pattern="^(daily|weekly|monthly|none)$")


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    priority: str | None = Field(default=None, pattern="^(low|medium|high|urgent)$")
    status: str | None = Field(default=None, pattern="^(pending|in_progress|completed|cancelled)$")
    type: str | None = Field(default=None, pattern="^(call|email|meeting|site_visit|install|follow_up|other)$")
    assigned_to: uuid.UUID | None = None
    due_date: date | None = None
    due_time: time | None = None
    duration_minutes: int | None = None
    is_all_day: bool | None = None
    recurrence: str | None = Field(default=None, pattern="^(daily|weekly|monthly|none)$")


# ── Response ─────────────────────────────────────────

class TaskResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    contact_id: uuid.UUID | None
    deal_id: uuid.UUID | None
    assigned_to: uuid.UUID | None
    created_by: uuid.UUID | None
    title: str
    description: str | None
    priority: str
    status: str
    type: str
    due_date: date | None
    due_time: time | None
    duration_minutes: int | None
    is_all_day: bool
    recurrence: str
    completed_at: datetime | None
    completed_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskListResponse(BaseModel):
    items: list[TaskResponse]
    meta: PaginationMeta


# ── Task Comments ────────────────────────────────────

class TaskCommentCreate(BaseModel):
    content: str = Field(min_length=1)


class TaskCommentResponse(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    user_id: uuid.UUID
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}
