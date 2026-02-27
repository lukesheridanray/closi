"""
Payments API routes -- Read-only listing and detail.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.tenant import get_current_org_id
from app.schemas.payments import PaymentResponse, PaymentListResponse
from app.services import payment_service

router = APIRouter(prefix="/payments", tags=["Payments"])


# ── List ─────────────────────────────────────────────


@router.get("", response_model=PaymentListResponse)
async def list_payments(
    contact_id: uuid.UUID | None = Query(default=None),
    contract_id: uuid.UUID | None = Query(default=None),
    payment_status: str | None = Query(default=None, alias="status", max_length=50),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    return await payment_service.list_payments(
        db,
        org_id,
        contact_id=contact_id,
        contract_id=contract_id,
        status=payment_status,
        page=page,
        page_size=page_size,
    )


# ── Get ──────────────────────────────────────────────


@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        payment = await payment_service.get_payment(db, org_id, payment_id)
        return PaymentResponse.model_validate(payment)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
