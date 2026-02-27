import uuid
from datetime import datetime
from pydantic import BaseModel


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total_count: int
    total_pages: int


class PaginatedResponse(BaseModel):
    """Base for all list responses with pagination."""
    meta: PaginationMeta


class TimestampMixin(BaseModel):
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IDMixin(BaseModel):
    id: uuid.UUID

    model_config = {"from_attributes": True}
