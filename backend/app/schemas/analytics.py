from pydantic import BaseModel


# ── Dashboard KPIs ───────────────────────────────────

class DashboardKPI(BaseModel):
    label: str
    value: float | int | str
    change_pct: float | None = None
    trend: str | None = None  # "up" | "down" | "flat"


class PipelineStageSummary(BaseModel):
    stage_id: str
    stage_name: str
    color: str
    deal_count: int
    total_value: float


class RepLeaderboard(BaseModel):
    user_id: str
    name: str
    deals_closed: int
    revenue: float
    activities: int


class DashboardResponse(BaseModel):
    kpis: list[DashboardKPI]
    pipeline_by_stage: list[PipelineStageSummary]
    rep_leaderboard: list[RepLeaderboard]


# ── Rep Dashboard ────────────────────────────────────

class RepDashboardResponse(BaseModel):
    kpis: list[DashboardKPI]
    my_pipeline: list[PipelineStageSummary]


# ── Recurring Revenue ────────────────────────────────

class MRRDataPoint(BaseModel):
    month: str
    mrr: float
    new_mrr: float
    churned_mrr: float


class RecurringRevenueResponse(BaseModel):
    current_mrr: float
    mrr_trend: list[MRRDataPoint]
    active_subscriptions: int
    churn_rate: float
    avg_revenue_per_account: float


# ── Pipeline Summary ─────────────────────────────────

class PipelineSummaryResponse(BaseModel):
    stages: list[PipelineStageSummary]
    total_pipeline_value: float
    total_deals: int
