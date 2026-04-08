import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign,
  PhoneCall,
  CalendarClock,
  Wrench,
  FileCheck,
  AlertTriangle as AlertTriangleIcon,
} from 'lucide-react'
import usePipelineStore from '@/stores/pipelineStore'
import useContactStore from '@/stores/contactStore'
import useTaskStore from '@/stores/taskStore'
import useInvoiceStore, { useOverdueInvoices, useOverdueTotal } from '@/stores/invoiceStore'
import useQuoteStore from '@/stores/quoteStore'
import { analyticsApi } from '@/lib/api'
import type { RecurringRevenueResponse } from '@/lib/api'
import KpiCard from './components/KpiCard'
import PipelineStageChart from './components/PipelineStageChart'
import LeadSourceChart from './components/LeadSourceChart'
import RecentActivityFeed from './components/RecentActivityFeed'
import TasksDueToday from './components/TasksDueToday'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export default function Dashboard() {
  const navigate = useNavigate()
  const deals = usePipelineStore((s) => s.deals)
  const stages = usePipelineStore((s) => s.stages)
  const pipelineLoading = usePipelineStore((s) => s.loading)
  const fetchPipelines = usePipelineStore((s) => s.fetchPipelines)
  const fetchDeals = usePipelineStore((s) => s.fetchDeals)
  const activePipelineId = usePipelineStore((s) => s.activePipelineId)
  const contacts = useContactStore((s) => s.contacts)
  const fetchContacts = useContactStore((s) => s.fetchContacts)
  const quotes = useQuoteStore((s) => s.quotes)
  const fetchQuotes = useQuoteStore((s) => s.fetchQuotes)
  const tasks = useTaskStore((s) => s.tasks)
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const fetchInvoices = useInvoiceStore((s) => s.fetchInvoices)
  const overdueInvoices = useOverdueInvoices()
  const overdueInvoiceTotal = useOverdueTotal()

  const [recurring, setRecurring] = useState<RecurringRevenueResponse | null>(null)

  useEffect(() => { fetchPipelines() }, [fetchPipelines])
  useEffect(() => {
    if (activePipelineId) fetchDeals(activePipelineId)
  }, [activePipelineId, fetchDeals])
  useEffect(() => { fetchContacts() }, [fetchContacts])
  useEffect(() => { fetchTasks() }, [fetchTasks])
  useEffect(() => { fetchQuotes() }, [fetchQuotes])
  useEffect(() => { fetchInvoices() }, [fetchInvoices])
  useEffect(() => {
    analyticsApi.getRecurringRevenue().then(setRecurring).catch(() => {})
  }, [])

  const stats = useMemo(() => {
    const wonStageIds = new Set(stages.filter((s) => s.is_won_stage).map((s) => s.id))
    const lostStageIds = new Set(stages.filter((s) => s.is_lost_stage).map((s) => s.id))
    const openDeals = deals.filter((d) => d.stage_id && !wonStageIds.has(d.stage_id) && !lostStageIds.has(d.stage_id))
    const now = new Date()
    const weekAhead = new Date(now)
    weekAhead.setDate(now.getDate() + 7)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const pipelineValue = openDeals.reduce((sum, d) => sum + d.estimated_value, 0)
    const newLeads = contacts.filter((c) => c.status === 'new').length
    const activeLeads = contacts.filter((c) => c.status === 'active').length

    const followUpQueue = tasks.filter((task) =>
      ['pending', 'in_progress'].includes(task.status) &&
      ['call', 'email', 'follow_up'].includes(task.type),
    )
    const installQueue = tasks.filter((task) =>
      ['pending', 'in_progress'].includes(task.status) && task.type === 'install',
    )
    const estimateQueue = tasks.filter((task) =>
      ['pending', 'in_progress'].includes(task.status) && task.type === 'site_visit',
    )
    const upcomingInstalls = installQueue.filter((task) =>
      task.due_date ? new Date(task.due_date) <= weekAhead : false,
    ).length
    const estimatesThisWeek = estimateQueue.filter((task) =>
      task.due_date ? new Date(task.due_date) <= weekAhead : false,
    ).length

    const dealsWonThisMonth = deals.filter(
      (d) => d.stage_id ? wonStageIds.has(d.stage_id) && new Date(d.updated_at) >= monthStart : false,
    ).length

    const mrr = recurring?.current_mrr ?? 0
    const activeCustomers = recurring?.active_subscriptions ?? 0

    const acceptedQuotes = quotes.filter((q) => q.status === 'accepted').length
    const rejectedQuotes = quotes.filter((q) => q.status === 'rejected' || q.status === 'expired').length
    const decisionedQuotes = acceptedQuotes + rejectedQuotes
    const quoteCloseRate = decisionedQuotes > 0 ? (acceptedQuotes / decisionedQuotes) * 100 : 0
    const sentQuotesValue = quotes.filter((q) => q.status === 'sent').reduce((sum, q) => sum + q.equipment_total, 0)

    return {
      mrr, pipelineValue, newLeads, activeLeads,
      followUpQueue: followUpQueue.length, estimatesThisWeek,
      installQueue: installQueue.length, upcomingInstalls,
      dealsWonThisMonth, activeCustomers, quoteCloseRate, sentQuotesValue,
      openDeals: openDeals.length,
    }
  }, [contacts, deals, quotes, recurring, stages, tasks])

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

  const leadSourceData = useMemo(() => {
    const sourceMap = new Map<string, { count: number; value: number }>()
    contacts.forEach((c) => {
      const source = c.lead_source ?? 'unknown'
      const label = source.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
      const existing = sourceMap.get(label) || { count: 0, value: 0 }
      existing.count += 1
      sourceMap.set(label, existing)
    })
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

  if (pipelineLoading && deals.length === 0 && stages.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading dashboard...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Installer Operations
        </p>
        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-heading">Operating Snapshot</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Follow-ups, installs, and monitoring revenue at a glance.
            </p>
          </div>
          <div className="rounded-xl bg-page px-4 py-3 text-sm text-body">
            <button onClick={() => navigate('/accounts')} className="font-semibold text-primary hover:underline">{stats.newLeads} new leads</button> waiting,
            {' '}<button onClick={() => navigate('/tasks')} className="font-semibold text-primary hover:underline">{stats.followUpQueue} follow-ups</button> open, and <button onClick={() => navigate('/tasks')} className="font-semibold text-primary hover:underline">{stats.upcomingInstalls} installs</button> due this week.
          </div>
        </div>
      </section>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Monitoring MRR"
          value={currencyFormat.format(stats.mrr)}
          trend={{ value: `${stats.activeCustomers} active accounts`, direction: 'up' }}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <KpiCard
          title="Follow-Up Queue"
          value={String(stats.followUpQueue)}
          trend={{ value: `${stats.newLeads} new leads need first contact`, direction: stats.followUpQueue > 0 ? 'down' : 'up' }}
          icon={<PhoneCall className="h-4 w-4" />}
        />
        <KpiCard
          title="Estimates This Week"
          value={String(stats.estimatesThisWeek)}
          trend={{ value: `${stats.activeLeads} active leads in play`, direction: 'neutral' }}
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <KpiCard
          title="Installs Scheduled"
          value={String(stats.installQueue)}
          trend={{ value: `${stats.upcomingInstalls} due in the next 7 days`, direction: stats.upcomingInstalls > 0 ? 'up' : 'neutral' }}
          icon={<Wrench className="h-4 w-4" />}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Open Pipeline"
          value={currencyFormat.format(stats.pipelineValue)}
          trend={{ value: `${stats.openDeals} open deals`, direction: 'neutral' }}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <KpiCard
          title="Quote Close Rate"
          value={`${stats.quoteCloseRate.toFixed(1)}%`}
          trend={{ value: `${stats.dealsWonThisMonth} won this month`, direction: stats.quoteCloseRate >= 50 ? 'up' : 'neutral' }}
          icon={<FileCheck className="h-4 w-4" />}
        />
        <KpiCard
          title="Quotes Awaiting Decision"
          value={currencyFormat.format(stats.sentQuotesValue)}
          trend={{ value: 'value in sent quotes', direction: 'neutral' }}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <KpiCard
          title="Active Monitoring"
          value={String(stats.activeCustomers)}
          trend={{ value: 'on recurring monitoring', direction: 'up' }}
          icon={<Wrench className="h-4 w-4" />}
        />
      </div>

      {/* Overdue invoice alert */}
      {overdueInvoices.length > 0 && (
        <button
          onClick={() => navigate('/billing')}
          className="flex w-full items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 shadow-card text-left transition-colors hover:bg-danger/10"
        >
          <AlertTriangleIcon className="h-5 w-5 flex-shrink-0 text-danger" />
          <div>
            <p className="text-sm font-semibold text-danger">{overdueInvoices.length} Overdue Invoice{overdueInvoices.length > 1 ? 's' : ''}</p>
            <p className="text-xs text-muted-foreground">Total: {currencyFormat.format(overdueInvoiceTotal)}</p>
          </div>
        </button>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PipelineStageChart stages={stageChartData} />
        <LeadSourceChart data={leadSourceData} />
      </div>

      {/* Tasks due today + recent activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TasksDueToday />
        <RecentActivityFeed />
      </div>
    </div>
  )
}
