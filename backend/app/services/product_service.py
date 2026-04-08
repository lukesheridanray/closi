"""
Product service -- CRUD for product catalog.
"""

import uuid
from datetime import datetime

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.schemas.products import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
)
from app.schemas.common import PaginationMeta


# -- List ------------------------------------------------------


async def list_products(
    db: AsyncSession,
    org_id: uuid.UUID,
    *,
    search: str | None = None,
    category: str | None = None,
    is_active: bool | None = None,
    sort_by: str = "name",
    sort_dir: str = "asc",
    page: int = 1,
    page_size: int = 25,
) -> ProductListResponse:
    base = select(Product).where(Product.organization_id == org_id)

    if is_active is not None:
        base = base.where(Product.is_active == is_active)

    if search:
        term = f"%{search}%"
        base = base.where(
            or_(
                Product.name.ilike(term),
                Product.sku.ilike(term),
                Product.description.ilike(term),
            )
        )

    if category:
        base = base.where(Product.category == category)

    # Total count
    count_q = select(func.count()).select_from(base.subquery())
    total_count = (await db.execute(count_q)).scalar_one()

    # Sort
    allowed_sort = {
        "name": Product.name,
        "sku": Product.sku,
        "category": Product.category,
        "unit_cost": Product.unit_cost,
        "retail_price": Product.retail_price,
        "created_at": Product.created_at,
    }
    sort_col = allowed_sort.get(sort_by, Product.name)
    order = sort_col.desc() if sort_dir == "desc" else sort_col.asc()

    query = base.order_by(order).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    products = result.scalars().all()

    total_pages = max(1, (total_count + page_size - 1) // page_size)

    return ProductListResponse(
        items=[ProductResponse.model_validate(p) for p in products],
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total_count=total_count,
            total_pages=total_pages,
        ),
    )


# -- Get -------------------------------------------------------


async def get_product(
    db: AsyncSession,
    org_id: uuid.UUID,
    product_id: uuid.UUID,
) -> Product:
    result = await db.execute(
        select(Product).where(
            Product.id == product_id,
            Product.organization_id == org_id,
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise ValueError("Product not found.")
    return product


# -- Create ----------------------------------------------------


async def create_product(
    db: AsyncSession,
    org_id: uuid.UUID,
    data: ProductCreate,
) -> Product:
    product = Product(
        organization_id=org_id,
        **data.model_dump(),
    )
    db.add(product)
    await db.flush()
    return product


# -- Update ----------------------------------------------------


async def update_product(
    db: AsyncSession,
    org_id: uuid.UUID,
    product_id: uuid.UUID,
    data: ProductUpdate,
) -> Product:
    product = await get_product(db, org_id, product_id)
    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(product, key, value)
    product.updated_at = datetime.utcnow()
    await db.flush()
    return product


# -- Soft Delete -----------------------------------------------


async def delete_product(
    db: AsyncSession,
    org_id: uuid.UUID,
    product_id: uuid.UUID,
) -> None:
    product = await get_product(db, org_id, product_id)
    product.is_active = False
    product.updated_at = datetime.utcnow()
    await db.flush()
