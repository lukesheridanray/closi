import { useState, useMemo, useEffect } from 'react'
import { DollarSign, TrendingUp, Trophy, Target, Users, BarChart3, RefreshCw, AlertTriangle as AlertTriangleIcon } from 'lucide-react'
import usePipelineStore from '@/stores/pipelineStore'
import { useEntityLabels } from '@/hooks/useEntityLabels'
import useContactStore from '@/stores/contactStore'
import useTaskStore from '@/stores/taskStore'
import useInvoiceStore, { useOverdueInvoices, useOverdueTotal } from '@/stores/invoiceStore'
import { analyticsApi } from '@/lib/api'
import type { RecurringRevenueResponse } from '@/lib/api'
import KpiCard from './components/KpiCard'
import PipelineStageChart from './components/PipelineStageChart'
import LeadSourceChart from './components/LeadSourceChart'
import RecentActivityFeed from './components/RecentActivityFeed'
import StaleDealsList from './components/StaleDealsList'
import RepLeaderboard from './components/RepLeaderboard'
import TasksDueToday from './components/TasksDueToday'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export default function Dashboard() {
  const { deal: dealLabel } = useEntityLabels()
  const deals = usePipelineStore((s) => s.deals)
  const stages = usePipelineStore((s) => s.stages)
  const pipelineLoading = usePipelineStore((s) => s.loading)
  const fetchPipelines = usePipelineStore((s) => s.fetchPipelines)
  const fetchDeals = usePipelineStore((s) => s.fetchDeals)
  const activePipelineId = usePipelineStore((s) => s.activePipelineId)
  const contacts = useContactStore((s) => s.contacts)
  const fetchContacts = useContactStore((s) => s.fetchContacts)
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const fetchInvoices = useInvoiceStore((s) => s.fetchInvoices)
  const overdueInvoices = useOverdueInvoices()
  const overdueInvoiceTotal = useOverdueTotal()

  const [recurring, setRecurring] = useState<RecurringRevenueResponse | null>(null)

  // Fetch all data needed by dashboard on mount
  useEffect(() => { fetchPipelines() }, [fetchPipelines])
  useEffect(() => {
    if (activePipelineId) fetchDeals(activePipelineId)
  }, [activePipelineId, fetchDeals])
  useEffect(() => { fetchContacts() }, [fetchContacts])
  useEffect(() => { fetchTasks() }, [fetchTasks])
  useEffect(() => { fetchInvoices() }, [fetchInvoices])
  useEffect(() => {
    analyticsApi.getRecurringRevenue().then(setRecurring).catch(() => {})
  }, [])

  // KPI calculations
  const kpis = useMemo(() => {
    const wonStageIds = new Set(stages.filter((s) => s.is_won_stage).map((s) => s.id))
    const lostStageIds = new Set(stages.filter((s) => s.is_lost_stage).map((s) => s.id))

    // Pipeline value: sum of open deals (not won/lost)
    const pipelineValue = deals
      .filter((d) => !wonStageIds.has(d.stage_id) && !lostStageIds.has(d.stage_id))
      .reduce((sum, d) => sum + d.estimated_value, 0)

    // Deals won this month
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const dealsWonThisMonth = deals.filter(
      (d) => wonStageIds.has(d.stage_id) && new Date(d.updated_at) >= monthStart,
    ).length

    // Conversion rate: won / (won + lost)
    const wonCount = deals.filter((d) => wonStageIds.has(d.stage_id)).length
    const lostCount = deals.filter((d) => lostStageIds.has(d.stage_id)).length
    const totalClosed = wonCount + lostCount
    const conversionRate = totalClosed > 0 ? (wonCount / totalClosed) * 100 : 0

    // Use analytics API for recurring revenue metrics
    const mrr = recurring?.current_mrr ?? 0
    const activeCustomers = recurring?.active_subscriptions ?? 0
    const arpa = recurring?.avg_revenue_per_account ?? 0
    const churnRate = recurring?.churn_rate ?? 0

    // LTV estimate
    const effectiveChurn = churnRate > 0 ? churnRate / 100 : 0.05
    const ltv = effectiveChurn > 0 ? arpa * (1 / effectiveChurn) : 0

    // LTV:CAC ratio (using $500 placeholder CAC)
    const cac = 500
    const ltvCacRatio = cac > 0 ? ltv / cac : 0

    return {
      mrr,
      pipelineValue,
      dealsWonThisMonth,
      conversionRate,
      activeCustomers,
      arpa,
      ltv,
      ltvCacRatio,
      cac,
      churnRate: effectiveChurn,
    }
  }, [deals, stages, recurring])

  // Pipeline stage chart data
  const stageChartData = useMemo(() => {
    const wonStageIds = new Set(stages.filter((s) => s.is_won_stage).map((s) => s.id))
    const lostStageIds = new Set(stages.filter((s) => s.is_lost_stage).map((s) => s.id))

    return stages
      .filter((s) => !wonStageIds.has(s.id) && !lostStageIds.has(s.id) && s.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((stage) => {
        const stageDeals = deals.filter((d) => d.stage_id === stage.id)
        return {
          name: stage.name,
          color: stage.color,
          count: stageDeals.length,
          value: stageDeals.reduce((sum, d) => sum + d.estimated_value, 0),
        }
      })
  }, [deals, stages])

  // Lead source chart data
  const leadSourceData = useMemo(() => {
    const sourceMap = new Map<string, { count: number; value: number }>()
    contacts.forEach((c) => {
      const source = c.lead_source ?? 'unknown'
      const label = source.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
      const existing = sourceMap.get(label) || { count: 0, value: 0 }
      existing.count += 1
      sourceMap.set(label, existing)
    })
    // Add deal values by contact source
    const contactSourceMap = new Map(contacts.map((c) => [c.id, c.lead_source ?? 'unknown']))
    deals.forEach((d) => {
      const source = contactSourceMap.get(d.contact_id)
      if (!source) return
      const label = source.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
      const existing = sourceMap.get(label)
      if (existing) existing.value += d.estimated_value
    })

    return [...sourceMap.entries()]
      .map(([source, data]) => ({ source, ...data }))
      .sort((a, b) => b.value - a.value)
  }, [contacts, deals])

  // LTV:CAC health color
  const ltvCacColor = kpis.ltvCacRatio >= 3 ? 'up' : kpis.ltvCacRatio >= 2 ? 'neutral' : 'down'

  if (pipelineLoading && deals.length === 0 && stages.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading dashboard...</div>
  }

  return (
    <div className="space-y-6">
      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Monthly Recurring Revenue"
          value={currencyFormat.format(kpis.mrr)}
          trend={{ value: 'vs last month', direction: 'up' }}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <KpiCard
          title="Pipeline Value"
          value={currencyFormat.format(kpis.pipelineValue)}
          trend={{ value: `${deals.filter((d) => !stages.find((s) => s.id === d.stage_id)?.is_won_stage && !stages.find((s) => s.id === d.stage_id)?.is_lost_stage).length} open ${dealLabel.pluralLower}`, direction: 'neutral' }}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiCard
          title={`${dealLabel.plural} Won This Month`}
          value={String(kpis.dealsWonThisMonth)}
          trend={{ value: 'this month', direction: kpis.dealsWonThisMonth > 0 ? 'up' : 'neutral' }}
          icon={<Trophy className="h-4 w-4" />}
        />
        <KpiCard
          title="Conversion Rate"
          value={`${kpis.conversionRate.toFixed(1)}%`}
          trend={{ value: 'win rate', direction: kpis.conversionRate >= 50 ? 'up' : 'down' }}
          icon={<Target className="h-4 w-4" />}
        />
      </div>

      {/* Secondary KPI Row (Financial Health) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="CAC"
          value={currencyFormat.format(kpis.cac)}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          title="LTV"
          value={currencyFormat.format(kpis.ltv)}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <KpiCard
          title="LTV:CAC Ratio"
          value={`${kpis.ltvCacRatio.toFixed(1)}:1`}
          trend={{ value: kpis.ltvCacRatio >= 3 ? 'Healthy' : kpis.ltvCacRatio >= 2 ? 'Moderate' : 'Low', direction: ltvCacColor }}
        />
        <KpiCard
          title="Monthly Churn"
          value={`${(kpis.churnRate * 100).toFixed(1)}%`}
          trend={{ value: 'placeholder', direction: 'neutral' }}
          icon={<RefreshCw className="h-4 w-4" />}
        />
        <KpiCard
          title="Active Customers"
          value={String(kpis.activeCustomers)}
          trend={{ value: `${currencyFormat.format(kpis.arpa)} ARPA`, direction: 'neutral' }}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PipelineStageChart stages={stageChartData} />
        <LeadSourceChart data={leadSourceData} />
      </div>

      {/* Bottom Grid: Activity, Tasks, Stale Deals, Leaderboard */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <TasksDueToday />
        <StaleDealsList />
        <div className="space-y-4">
          {overdueInvoices.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 p-4 shadow-card">
              <AlertTriangleIcon className="h-5 w-5 text-danger" />
              <div>
                <p className="text-sm font-semibold text-danger">{overdueInvoices.length} Overdue Invoice{overdueInvoices.length > 1 ? 's' : ''}</p>
                <p className="text-xs text-muted-foreground">Total: {currencyFormat.format(overdueInvoiceTotal)}</p>
              </div>
            </div>
          )}
          <RepLeaderboard />
        </div>
      </div>

      {/* Recent Activity */}
      <RecentActivityFeed />
    </div>
  )
}
