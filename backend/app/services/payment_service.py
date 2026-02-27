"""
Payment service -- Read-only listing and detail.
Payments are created by webhook handlers, not by users directly.
"""

import uuid
from datetime import date

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import Payment
from app.schemas.payments import PaymentResponse, PaymentListResponse
from app.schemas.common import PaginationMeta


# ── List ─────────────────────────────────────────────


async def list_payments(
    db: AsyncSession,
    org_id: uuid.UUID,
    *,
    contact_id: uuid.UUID | None = None,
    contract_id: uuid.UUID | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> PaymentListResponse:
    base = select(Payment).where(Payment.organization_id == org_id)

    if contact_id:
        base = base.where(Payment.contact_id == contact_id)
    if contract_id:
        base = base.where(Payment.contract_id == contract_id)
    if status:
        base = base.where(Payment.status == status)

    count_q = select(func.count()).select_from(base.subquery())
    total_count = (await db.execute(count_q)).scalar_one()

    query = (
        base.order_by(Payment.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    payments = result.scalars().all()

    total_pages = max(1, (total_count + page_size - 1) // page_size)

    return PaymentListResponse(
        items=[PaymentResponse.model_validate(p) for p in payments],
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total_count=total_count,
            total_pages=total_pages,
        ),
    )


# ── Get ──────────────────────────────────────────────


async def get_payment(
    db: AsyncSession,
    org_id: uuid.UUID,
    payment_id: uuid.UUID,
) -> Payment:
    result = await db.execute(
        select(Payment).where(
            Payment.id == payment_id,
            Payment.organization_id == org_id,
        )
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise ValueError("Payment not found.")
    return payment
