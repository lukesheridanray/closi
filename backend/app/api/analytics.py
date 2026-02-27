"""
Analytics API routes -- Dashboard KPIs, MRR, pipeline summary.
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import AuthContext, get_current_user
from app.middleware.tenant import get_current_org_id
from app.schemas.analytics import (
    DashboardResponse,
    RepDashboardResponse,
    RecurringRevenueResponse,
    PipelineSummaryResponse,
)
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


# ── Owner Dashboard ──────────────────────────────────


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    return await analytics_service.get_dashboard(db, org_id)


# ── Rep Dashboard ────────────────────────────────────


@router.get("/rep-dashboard", response_model=RepDashboardResponse)
async def get_rep_dashboard(
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await analytics_service.get_rep_dashboard(db, auth.org_id, auth.user_id)


# ── Recurring Revenue ────────────────────────────────


@router.get("/recurring-revenue", response_model=RecurringRevenueResponse)
async def get_recurring_revenue(
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    return await analytics_service.get_recurring_revenue(db, org_id)


# ── Pipeline Summary ─────────────────────────────────


@router.get("/pipeline-summary", response_model=PipelineSummaryResponse)
async def get_pipeline_summary(
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    return await analytics_service.get_pipeline_summary(db, org_id)
