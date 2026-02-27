import { useMemo } from 'react'
import { DollarSign, TrendingUp, Trophy, Target, Users, BarChart3, RefreshCw, AlertTriangle as AlertTriangleIcon } from 'lucide-react'
import usePipelineStore from '@/stores/pipelineStore'
import useContractStore, { useMRR } from '@/stores/contractStore'
import useContactStore from '@/stores/contactStore'
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
  const deals = usePipelineStore((s) => s.deals)
  const stages = usePipelineStore((s) => s.stages)
  const contacts = useContactStore((s) => s.contacts)
  const contracts = useContractStore((s) => s.contracts)
  const payments = useContractStore((s) => s.payments)
  const mrr = useMRR()

  // KPI calculations
  const kpis = useMemo(() => {
    const wonStageIds = new Set(stages.filter((s) => s.is_won).map((s) => s.id))
    const lostStageIds = new Set(stages.filter((s) => s.is_lost).map((s) => s.id))

    // Pipeline value: sum of open deals (not won/lost)
    const pipelineValue = deals
      .filter((d) => !wonStageIds.has(d.stage_id) && !lostStageIds.has(d.stage_id))
      .reduce((sum, d) => sum + d.value, 0)

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

    // Active customers
    const activeCustomers = contracts.filter((c) => c.status === 'active').length

    // Avg revenue per account
    const arpa = activeCustomers > 0 ? mrr / activeCustomers : 0

    // LTV estimate (assuming ~5% monthly churn as placeholder)
    const churnRate = 0.05
    const ltv = churnRate > 0 ? arpa * (1 / churnRate) : 0

    // LTV:CAC ratio (using $500 placeholder CAC)
    const cac = 500
    const ltvCacRatio = cac > 0 ? ltv / cac : 0

    // Failed payments
    const failedPayments = payments.filter((p) => p.status === 'failed').length

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
      churnRate,
      failedPayments,
    }
  }, [deals, stages, contracts, payments, mrr])

  // Pipeline stage chart data
  const stageChartData = useMemo(() => {
    const wonStageIds = new Set(stages.filter((s) => s.is_won).map((s) => s.id))
    const lostStageIds = new Set(stages.filter((s) => s.is_lost).map((s) => s.id))

    return stages
      .filter((s) => !wonStageIds.has(s.id) && !lostStageIds.has(s.id) && s.is_active)
      .sort((a, b) => a.position - b.position)
      .map((stage) => {
        const stageDeals = deals.filter((d) => d.stage_id === stage.id)
        return {
          name: stage.name,
          color: stage.color,
          count: stageDeals.length,
          value: stageDeals.reduce((sum, d) => sum + d.value, 0),
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
      if (existing) existing.value += d.value
    })

    return [...sourceMap.entries()]
      .map(([source, data]) => ({ source, ...data }))
      .sort((a, b) => b.value - a.value)
  }, [contacts, deals])

  // LTV:CAC health color
  const ltvCacColor = kpis.ltvCacRatio >= 3 ? 'up' : kpis.ltvCacRatio >= 2 ? 'neutral' : 'down'

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
          trend={{ value: `${deals.filter((d) => !stages.find((s) => s.id === d.stage_id)?.is_won && !stages.find((s) => s.id === d.stage_id)?.is_lost).length} open deals`, direction: 'neutral' }}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiCard
          title="Deals Won This Month"
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
          {kpis.failedPayments > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 p-4 shadow-card">
              <AlertTriangleIcon className="h-5 w-5 text-danger" />
              <div>
                <p className="text-sm font-semibold text-danger">{kpis.failedPayments} Failed Payments</p>
                <p className="text-xs text-muted-foreground">Review in Contracts</p>
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
