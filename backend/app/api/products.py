"""
Products API routes -- CRUD for product catalog.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.tenant import get_current_org_id
from app.schemas.products import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
)
from app.schemas.auth import MessageResponse
from app.services import product_service
from app.seed_products import seed_products

router = APIRouter(prefix="/products", tags=["Products"])


# -- List ------------------------------------------------------


@router.get("", response_model=ProductListResponse)
async def list_products(
    search: str | None = Query(default=None, max_length=200),
    category: str | None = Query(default=None, max_length=50),
    is_active: bool | None = Query(default=None),
    sort_by: str = Query(default="name", max_length=50),
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    return await product_service.list_products(
        db,
        org_id,
        search=search,
        category=category,
        is_active=is_active,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )


# -- Get -------------------------------------------------------


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        product = await product_service.get_product(db, org_id, product_id)
        return ProductResponse.model_validate(product)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# -- Create ----------------------------------------------------


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        product = await product_service.create_product(db, org_id, data)
        return ProductResponse.model_validate(product)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# -- Update ----------------------------------------------------


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    data: ProductUpdate,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        product = await product_service.update_product(db, org_id, product_id, data)
        return ProductResponse.model_validate(product)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# -- Delete (soft) ---------------------------------------------


@router.delete("/{product_id}", response_model=MessageResponse)
async def delete_product(
    product_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        await product_service.delete_product(db, org_id, product_id)
        return MessageResponse(message="Product deactivated.")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# -- Seed default products ------------------------------------


@router.post("/seed", response_model=MessageResponse)
async def seed_default_products(
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    count = await seed_products(db, org_id)
    await db.commit()
    return MessageResponse(message=f"Seeded {count} products.")
