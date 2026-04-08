import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas.common import PaginationMeta


# -- Create / Update ------------------------------------------


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    sku: str | None = Field(default=None, max_length=100)
    category: str = Field(default="other", max_length=50)
    description: str | None = None
    unit_cost: float = 0
    retail_price: float = 0
    is_active: bool = True


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    sku: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=50)
    description: str | None = None
    unit_cost: float | None = None
    retail_price: float | None = None
    is_active: bool | None = None


# -- Response --------------------------------------------------


class ProductResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    sku: str | None
    category: str
    description: str | None
    unit_cost: float
    retail_price: float
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    meta: PaginationMeta
