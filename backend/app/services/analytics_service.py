"""
Analytics service -- Dashboard queries, MRR calculations, KPI aggregations.
"""

import uuid
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

from sqlalchemy import select, func, and_, case, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deal import Deal
from app.models.pipeline import PipelineStage
from app.models.contact import Contact
from app.models.activity import Activity
from app.models.subscription import Subscription
from app.models.invoice import Invoice
from app.models.user import User
from app.schemas.analytics import (
    DashboardResponse,
    DashboardKPI,
    PipelineStageSummary,
    RepLeaderboard,
    RepDashboardResponse,
    RecurringRevenueResponse,
    MRRDataPoint,
    PipelineSummaryResponse,
)


# ── Owner Dashboard ──────────────────────────────────


async def get_dashboard(
    db: AsyncSession,
    org_id: uuid.UUID,
) -> DashboardResponse:
    now = datetime.utcnow()
    month_ago = now - timedelta(days=30)

    # KPI: Total contacts
    total_contacts = (await db.execute(
        select(func.count()).where(
            Contact.organization_id == org_id,
            Contact.is_deleted == False,  # noqa: E712
        )
    )).scalar_one()

    # KPI: New contacts this month
    new_contacts = (await db.execute(
        select(func.count()).where(
            Contact.organization_id == org_id,
            Contact.is_deleted == False,  # noqa: E712
            Contact.created_at >= month_ago,
        )
    )).scalar_one()

    # KPI: Open deals value
    open_deals_value = (await db.execute(
        select(func.coalesce(func.sum(Deal.estimated_value), 0)).where(
            Deal.organization_id == org_id,
            Deal.is_deleted == False,  # noqa: E712
            Deal.closed_at.is_(None),
        )
    )).scalar_one()

    # KPI: Deals closed this month
    closed_deals = (await db.execute(
        select(func.count()).where(
            Deal.organization_id == org_id,
            Deal.is_deleted == False,  # noqa: E712
            Deal.closed_at >= month_ago,
        )
    )).scalar_one()

    # KPI: Revenue this month (from paid invoices)
    monthly_revenue = (await db.execute(
        select(func.coalesce(func.sum(Invoice.total), 0)).where(
            Invoice.organization_id == org_id,
            Invoice.status == "paid",
            Invoice.paid_at >= month_ago,
        )
    )).scalar_one()

    kpis = [
        DashboardKPI(label="Total Contacts", value=total_contacts),
        DashboardKPI(label="New Contacts (30d)", value=new_contacts),
        DashboardKPI(label="Open Pipeline", value=float(open_deals_value)),
        DashboardKPI(label="Deals Closed (30d)", value=closed_deals),
        DashboardKPI(label="Revenue (30d)", value=float(monthly_revenue)),
    ]

    # Pipeline by stage
    pipeline_by_stage = await _get_pipeline_stages(db, org_id)

    # Rep leaderboard
    rep_leaderboard = await _get_rep_leaderboard(db, org_id, month_ago)

    return DashboardResponse(
        kpis=kpis,
        pipeline_by_stage=pipeline_by_stage,
        rep_leaderboard=rep_leaderboard,
    )


# ── Rep Dashboard ────────────────────────────────────


async def get_rep_dashboard(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
) -> RepDashboardResponse:
    now = datetime.utcnow()
    month_ago = now - timedelta(days=30)

    # KPI: My open deals
    my_open_deals = (await db.execute(
        select(func.count()).where(
            Deal.organization_id == org_id,
            Deal.assigned_to == user_id,
            Deal.is_deleted == False,  # noqa: E712
            Deal.closed_at.is_(None),
        )
    )).scalar_one()

    # KPI: My pipeline value
    my_pipeline_value = (await db.execute(
        select(func.coalesce(func.sum(Deal.estimated_value), 0)).where(
            Deal.organization_id == org_id,
            Deal.assigned_to == user_id,
            Deal.is_deleted == False,  # noqa: E712
            Deal.closed_at.is_(None),
        )
    )).scalar_one()

    # KPI: My closed deals this month
    my_closed = (await db.execute(
        select(func.count()).where(
            Deal.organization_id == org_id,
            Deal.assigned_to == user_id,
            Deal.is_deleted == False,  # noqa: E712
            Deal.closed_at >= month_ago,
        )
    )).scalar_one()

    # KPI: My activities this month
    my_activities = (await db.execute(
        select(func.count()).where(
            Activity.organization_id == org_id,
            Activity.performed_by == user_id,
            Activity.performed_at >= month_ago,
        )
    )).scalar_one()

    kpis = [
        DashboardKPI(label="My Open Deals", value=my_open_deals),
        DashboardKPI(label="My Pipeline Value", value=float(my_pipeline_value)),
        DashboardKPI(label="My Deals Closed (30d)", value=my_closed),
        DashboardKPI(label="My Activities (30d)", value=my_activities),
    ]

    # My pipeline by stage
    my_pipeline = await _get_pipeline_stages(db, org_id, assigned_to=user_id)

    return RepDashboardResponse(
        kpis=kpis,
        my_pipeline=my_pipeline,
    )


# ── Recurring Revenue ────────────────────────────────


async def get_recurring_revenue(
    db: AsyncSession,
    org_id: uuid.UUID,
) -> RecurringRevenueResponse:
    # Current MRR from active subscriptions
    current_mrr_result = await db.execute(
        select(func.coalesce(func.sum(Subscription.amount), 0)).where(
            Subscription.organization_id == org_id,
            Subscription.status == "active",
        )
    )
    current_mrr = float(current_mrr_result.scalar_one())

    # Active subscription count
    active_subs = (await db.execute(
        select(func.count()).where(
            Subscription.organization_id == org_id,
            Subscription.status == "active",
        )
    )).scalar_one()

    # Total subscriptions (for churn rate)
    total_subs = (await db.execute(
        select(func.count()).where(
            Subscription.organization_id == org_id,
        )
    )).scalar_one()

    # Cancelled in last 30 days
    now = datetime.utcnow()
    month_ago = now - timedelta(days=30)
    cancelled_subs = (await db.execute(
        select(func.count()).where(
            Subscription.organization_id == org_id,
            Subscription.status == "cancelled",
            Subscription.cancelled_at >= month_ago,
        )
    )).scalar_one()

    active_at_start = active_subs + cancelled_subs
    churn_rate = (cancelled_subs / active_at_start * 100) if active_at_start > 0 else 0

    # Average revenue per account
    arpa = current_mrr / active_subs if active_subs > 0 else 0

    # MRR trend (last 6 months) -- simplified using subscription created_at
    mrr_trend: list[MRRDataPoint] = []
    for i in range(5, -1, -1):
        month_start = (now - relativedelta(months=i)).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        month_end = (month_start + relativedelta(months=1))
        month_label = month_start.strftime("%Y-%m")

        # Active subs at that month's end
        month_mrr = (await db.execute(
            select(func.coalesce(func.sum(Subscription.amount), 0)).where(
                Subscription.organization_id == org_id,
                Subscription.created_at < month_end,
                Subscription.status.in_(["active", "past_due", "cancelled", "expired"]),
            )
        )).scalar_one()

        # New subs in that month
        new_mrr = (await db.execute(
            select(func.coalesce(func.sum(Subscription.amount), 0)).where(
                Subscription.organization_id == org_id,
                Subscription.created_at >= month_start,
                Subscription.created_at < month_end,
            )
        )).scalar_one()

        # Churned in that month
        churned_mrr = (await db.execute(
            select(func.coalesce(func.sum(Subscription.amount), 0)).where(
                Subscription.organization_id == org_id,
                Subscription.status == "cancelled",
                Subscription.cancelled_at >= month_start,
                Subscription.cancelled_at < month_end,
            )
        )).scalar_one()

        mrr_trend.append(MRRDataPoint(
            month=month_label,
            mrr=float(month_mrr),
            new_mrr=float(new_mrr),
            churned_mrr=float(churned_mrr),
        ))

    return RecurringRevenueResponse(
        current_mrr=current_mrr,
        mrr_trend=mrr_trend,
        active_subscriptions=active_subs,
        churn_rate=round(churn_rate, 2),
        avg_revenue_per_account=round(arpa, 2),
    )


# ── Pipeline Summary ─────────────────────────────────


async def get_pipeline_summary(
    db: AsyncSession,
    org_id: uuid.UUID,
) -> PipelineSummaryResponse:
    stages = await _get_pipeline_stages(db, org_id)

    total_value = sum(s.total_value for s in stages)
    total_deals = sum(s.deal_count for s in stages)

    return PipelineSummaryResponse(
        stages=stages,
        total_pipeline_value=total_value,
        total_deals=total_deals,
    )


# ── Helpers ──────────────────────────────────────────


async def _get_pipeline_stages(
    db: AsyncSession,
    org_id: uuid.UUID,
    *,
    assigned_to: uuid.UUID | None = None,
) -> list[PipelineStageSummary]:
    """Get pipeline stage summaries with deal counts and values."""
    stages_result = await db.execute(
        select(PipelineStage)
        .where(
            PipelineStage.organization_id == org_id,
            PipelineStage.is_active == True,  # noqa: E712
        )
        .order_by(PipelineStage.sort_order.asc())
    )
    stages = stages_result.scalars().all()

    summaries = []
    for stage in stages:
        deal_filter = [
            Deal.organization_id == org_id,
            Deal.stage_id == stage.id,
            Deal.is_deleted == False,  # noqa: E712
        ]
        if assigned_to:
            deal_filter.append(Deal.assigned_to == assigned_to)

        count_result = await db.execute(
            select(
                func.count(),
                func.coalesce(func.sum(Deal.estimated_value), 0),
            ).where(*deal_filter)
        )
        row = count_result.one()

        summaries.append(PipelineStageSummary(
            stage_id=str(stage.id),
            stage_name=stage.name,
            color=stage.color,
            deal_count=row[0],
            total_value=float(row[1]),
        ))

    return summaries


async def _get_rep_leaderboard(
    db: AsyncSession,
    org_id: uuid.UUID,
    since: datetime,
) -> list[RepLeaderboard]:
    """Get rep leaderboard based on closed deals and activities."""
    users_result = await db.execute(
        select(User).where(
            User.organization_id == org_id,
            User.is_active == True,  # noqa: E712
            User.role.in_(["sales_rep", "manager", "owner", "admin"]),
        )
    )
    users = users_result.scalars().all()

    leaderboard = []
    for user in users:
        closed = (await db.execute(
            select(func.count()).where(
                Deal.organization_id == org_id,
                Deal.assigned_to == user.id,
                Deal.is_deleted == False,  # noqa: E712
                Deal.closed_at >= since,
            )
        )).scalar_one()

        revenue = (await db.execute(
            select(func.coalesce(func.sum(Deal.estimated_value), 0)).where(
                Deal.organization_id == org_id,
                Deal.assigned_to == user.id,
                Deal.is_deleted == False,  # noqa: E712
                Deal.closed_at >= since,
            )
        )).scalar_one()

        activities_count = (await db.execute(
            select(func.count()).where(
                Activity.organization_id == org_id,
                Activity.performed_by == user.id,
                Activity.performed_at >= since,
            )
        )).scalar_one()

        leaderboard.append(RepLeaderboard(
            user_id=str(user.id),
            name=f"{user.first_name} {user.last_name}",
            deals_closed=closed,
            revenue=float(revenue),
            activities=activities_count,
        ))

    # Sort by revenue descending
    leaderboard.sort(key=lambda r: r.revenue, reverse=True)
    return leaderboard
