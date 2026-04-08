"""
Billing Ops API routes -- billing health and account-level billing summaries.
"""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.tenant import get_current_org_id
from app.schemas.billing import BillingAccountListResponse
from app.services import billing_service

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.get("/accounts", response_model=BillingAccountListResponse)
async def list_billing_accounts(
    search: str | None = Query(default=None, max_length=200),
    billing_flag: str | None = Query(default=None, max_length=50),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    return await billing_service.list_billing_accounts(
        db,
        org_id,
        search=search,
        billing_flag=billing_flag,
        page=page,
        page_size=page_size,
    )
