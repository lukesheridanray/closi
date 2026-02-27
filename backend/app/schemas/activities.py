import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas.common import PaginationMeta


# ── Create ───────────────────────────────────────────

class ActivityCreate(BaseModel):
    contact_id: uuid.UUID
    deal_id: uuid.UUID | None = None
    type: str = Field(
        max_length=50,
        pattern="^(note|call|email|meeting|site_visit|task_created|task_completed|deal_created|stage_change|quote_sent)$",
    )
    subject: str = Field(min_length=1, max_length=255)
    description: str | None = None


# ── Response ─────────────────────────────────────────

class ActivityResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    contact_id: uuid.UUID
    deal_id: uuid.UUID | None
    type: str
    subject: str
    description: str | None
    performed_by: uuid.UUID | None
    performed_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityListResponse(BaseModel):
    items: list[ActivityResponse]
    meta: PaginationMeta
