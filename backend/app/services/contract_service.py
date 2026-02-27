"""
Contract service -- CRUD, subscription creation, LTV calculation.
"""

import uuid
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.models.subscription import Subscription
from app.schemas.contracts import (
    ContractCreate,
    ContractUpdate,
    ContractResponse,
    ContractListResponse,
)
from app.schemas.common import PaginationMeta


# ── List ─────────────────────────────────────────────


async def list_contracts(
    db: AsyncSession,
    org_id: uuid.UUID,
    *,
    status: str | None = None,
    contact_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 25,
) -> ContractListResponse:
    base = select(Contract).where(Contract.organization_id == org_id)

    if status:
        base = base.where(Contract.status == status)
    if contact_id:
        base = base.where(Contract.contact_id == contact_id)

    count_q = select(func.count()).select_from(base.subquery())
    total_count = (await db.execute(count_q)).scalar_one()

    query = (
        base.order_by(Contract.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    contracts = result.scalars().all()

    total_pages = max(1, (total_count + page_size - 1) // page_size)

    return ContractListResponse(
        items=[ContractResponse.model_validate(c) for c in contracts],
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total_count=total_count,
            total_pages=total_pages,
        ),
    )


# ── Get ──────────────────────────────────────────────


async def get_contract(
    db: AsyncSession,
    org_id: uuid.UUID,
    contract_id: uuid.UUID,
) -> Contract:
    result = await db.execute(
        select(Contract).where(
            Contract.id == contract_id,
            Contract.organization_id == org_id,
        )
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise ValueError("Contract not found.")
    return contract


# ── Create ───────────────────────────────────────────


async def create_contract(
    db: AsyncSession,
    org_id: uuid.UUID,
    data: ContractCreate,
) -> Contract:
    # Calculate total_value if not provided
    total_value = data.total_value
    if total_value == 0 and data.monthly_amount > 0:
        total_value = float(data.monthly_amount * data.term_months) + float(data.equipment_total)

    contract = Contract(
        organization_id=org_id,
        status="pending",
        total_value=total_value,
        **data.model_dump(exclude={"total_value"}),
    )
    db.add(contract)
    await db.flush()
    return contract


# ── Update ───────────────────────────────────────────


async def update_contract(
    db: AsyncSession,
    org_id: uuid.UUID,
    contract_id: uuid.UUID,
    data: ContractUpdate,
) -> Contract:
    contract = await get_contract(db, org_id, contract_id)
    updates = data.model_dump(exclude_unset=True)

    # Handle cancellation
    if updates.get("status") == "cancelled" and contract.status != "cancelled":
        updates["cancelled_at"] = datetime.utcnow()

    for key, value in updates.items():
        setattr(contract, key, value)
    contract.updated_at = datetime.utcnow()
    await db.flush()
    return contract


# ── LTV Calculation ──────────────────────────────────


async def calculate_ltv(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_id: uuid.UUID,
) -> float:
    """Calculate lifetime value for a contact across all contracts."""
    result = await db.execute(
        select(func.sum(Contract.total_value)).where(
            Contract.organization_id == org_id,
            Contract.contact_id == contact_id,
            Contract.status.in_(["active", "expired"]),
        )
    )
    return float(result.scalar_one() or 0)
