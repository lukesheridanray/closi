import { useState, useEffect, useMemo } from 'react'
import { differenceInMonths, format } from 'date-fns'
import { DollarSign, TrendingUp, TrendingDown, Users, AlertTriangle, Clock } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'
import { analyticsApi, subscriptionsApi } from '@/lib/api'
import type { RecurringRevenueResponse } from '@/lib/api'
import type { Subscription } from '@/types/contract'
import useContactStore from '@/stores/contactStore'
import { useOverdueInvoices, useOverdueTotal } from '@/stores/invoiceStore'
import useInvoiceStore from '@/stores/invoiceStore'
import KpiCard from '@/pages/dashboard/components/KpiCard'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const currencyFormatShort = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export default function Reports() {
  const contacts = useContactStore((s) => s.contacts)
  const fetchContacts = useContactStore((s) => s.fetchContacts)
  const fetchInvoices = useInvoiceStore((s) => s.fetchInvoices)
  const overdueInvoices = useOverdueInvoices()
  const overdueInvoiceTotal = useOverdueTotal()

  const [recurring, setRecurring] = useState<RecurringRevenueResponse | null>(null)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchContacts()
    fetchInvoices()
  }, [fetchContacts, fetchInvoices])

  useEffect(() => {
    Promise.all([
      analyticsApi.getRecurringRevenue(),
      subscriptionsApi.list({ page_size: 100 }),
    ])
      .then(([rrData, subData]) => {
        setRecurring(rrData)
        setSubscriptions(subData.items)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Derived stats
  const stats = useMemo(() => {
    if (!recurring) return null

    const activeSubs = subscriptions.filter((s) => s.status === 'active')
    const pastDueSubs = subscriptions.filter((s) => s.status === 'past_due')
    const cancelledSubs = subscriptions.filter((s) => s.status === 'cancelled')

    // Net new MRR this month (subscriptions created this month)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const newThisMonth = activeSubs.filter(
      (s) => new Date(s.created_at) >= monthStart,
    )
    const netNewMRR = newThisMonth.reduce((sum, s) => sum + s.amount, 0)

    // Churned MRR this month
    const churnedThisMonth = cancelledSubs.filter(
      (s) => s.cancelled_at && new Date(s.cancelled_at) >= monthStart,
    )
    const churnedMRR = churnedThisMonth.reduce((sum, s) => sum + s.amount, 0)

    // MRR waterfall
    const startingMRR = recurring.current_mrr - netNewMRR + churnedMRR
    const waterfall = [
      { name: 'Starting', value: startingMRR, color: '#6C63FF' },
      { name: 'New', value: netNewMRR, color: '#22C55E' },
      { name: 'Churned', value: -churnedMRR, color: '#EF4444' },
      { name: 'Ending', value: recurring.current_mrr, color: '#3B82F6' },
    ]

    // MRR trend from API (real data from subscriptions table)
    const mrrTrend = recurring.mrr_trend.map((pt) => ({
      month: format(new Date(pt.month + '-01'), 'MMM'),
      mrr: pt.mrr,
      new_mrr: pt.new_mrr,
      churned_mrr: pt.churned_mrr,
    }))

    // Subscription table rows
    const contactMap = new Map(contacts.map((c) => [c.id, c]))
    const tableRows = activeSubs.map((sub) => {
      const contact = contactMap.get(sub.contact_id)
      const tenure = differenceInMonths(now, new Date(sub.created_at))
      const paymentHealth: 'good' | 'warning' | 'critical' =
        sub.failed_payment_count === 0
          ? 'good'
          : sub.failed_payment_count === 1
            ? 'warning'
            : 'critical'

      return {
        id: sub.id,
        customerName: contact
          ? `${contact.first_name} ${contact.last_name}`
          : 'Unknown',
        monthlyAmount: sub.amount,
        startDate: sub.created_at,
        tenure,
        paymentHealth,
        nextBilling: sub.next_billing_date
          ? format(new Date(sub.next_billing_date), 'MMM d, yyyy')
          : 'N/A',
        billingInterval: sub.billing_interval,
        status: sub.status,
      }
    })

    return {
      activeCount: activeSubs.length,
      pastDueCount: pastDueSubs.length,
      cancelledCount: cancelledSubs.length,
      netNewMRR,
      mrrTrend,
      waterfall,
      tableRows,
    }
  }, [recurring, subscriptions, contacts])

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading reports...</div>
  }

  if (!recurring || !stats) {
    return <div className="py-12 text-center text-sm text-muted-foreground">No recurring revenue data available</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-heading">Recurring Revenue Dashboard</h1>

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total MRR"
          value={currencyFormatShort.format(recurring.current_mrr)}
          trend={{ value: 'current', direction: 'up' }}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <KpiCard
          title="Net New MRR"
          value={currencyFormat.format(stats.netNewMRR)}
          trend={{ value: 'this month', direction: stats.netNewMRR > 0 ? 'up' : 'neutral' }}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiCard
          title="Avg Revenue / Account"
          value={currencyFormatShort.format(recurring.avg_revenue_per_account)}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          title="Active Subscribers"
          value={String(recurring.active_subscriptions)}
          trend={{
            value: stats.pastDueCount > 0 ? `${stats.pastDueCount} past due` : 'all current',
            direction: stats.pastDueCount > 0 ? 'down' : 'up',
          }}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      {/* Overdue Invoices Alert */}
      {overdueInvoices.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 p-4">
          <AlertTriangle className="h-5 w-5 text-danger" />
          <div>
            <p className="text-sm font-semibold text-danger">
              {overdueInvoices.length} Overdue Invoice{overdueInvoices.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              Total overdue: {currencyFormatShort.format(overdueInvoiceTotal)}
            </p>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* MRR Trend */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            MRR Trend (6 Months)
          </h3>
          {stats.mrrTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats.mrrTrend}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(value: number) => [currencyFormatShort.format(value), 'MRR']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)' }}
                />
                <Line
                  type="monotone"
                  dataKey="mrr"
                  stroke="#6C63FF"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#6C63FF' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">No trend data</p>
          )}
        </div>

        {/* MRR Waterfall */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            MRR Movement This Month
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.waterfall}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${Math.abs(v)}`} />
              <Tooltip
                formatter={(value: number) => [currencyFormatShort.format(Math.abs(value)), '']}
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={48}>
                {stats.waterfall.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Customer Counts + Churn */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Customer Breakdown */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Subscriber Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-success/5 p-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-success" />
                <span className="text-sm font-medium text-heading">Active</span>
              </div>
              <span className="text-lg font-bold text-success">{stats.activeCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-warning/5 p-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-warning" />
                <span className="text-sm font-medium text-heading">Past Due</span>
              </div>
              <span className="text-lg font-bold text-warning">{stats.pastDueCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-danger/5 p-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-danger" />
                <span className="text-sm font-medium text-heading">Cancelled</span>
              </div>
              <span className="text-lg font-bold text-danger">{stats.cancelledCount}</span>
            </div>
          </div>
        </div>

        {/* Churn + Revenue Health */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h3 className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5 text-warning" />
            Revenue Health
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-heading">Monthly Churn Rate</p>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </div>
              <span className={`text-lg font-bold ${recurring.churn_rate > 5 ? 'text-danger' : recurring.churn_rate > 2 ? 'text-warning' : 'text-success'}`}>
                {recurring.churn_rate.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-heading">ARPA</p>
                <p className="text-xs text-muted-foreground">Average revenue per account</p>
              </div>
              <span className="text-lg font-bold text-primary">
                {currencyFormatShort.format(recurring.avg_revenue_per_account)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-heading">Annual Run Rate</p>
                <p className="text-xs text-muted-foreground">MRR x 12</p>
              </div>
              <span className="text-lg font-bold text-primary">
                {currencyFormat.format(recurring.current_mrr * 12)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Subscriptions Table */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-card">
        <h3 className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Active Subscriptions ({stats.tableRows.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</th>
                <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly</th>
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Started</th>
                <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tenure</th>
                <th className="pb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment</th>
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next Billing</th>
                <th className="pb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Interval</th>
              </tr>
            </thead>
            <tbody>
              {stats.tableRows.map((sub) => (
                <tr key={sub.id} className="border-b border-border/50 last:border-b-0">
                  <td className="py-2.5 text-sm font-medium text-heading">{sub.customerName}</td>
                  <td className="py-2.5 text-right text-sm font-bold text-primary">
                    {currencyFormatShort.format(sub.monthlyAmount)}
                  </td>
                  <td className="py-2.5 text-sm text-body">
                    {format(new Date(sub.startDate), 'MMM d, yyyy')}
                  </td>
                  <td className="py-2.5 text-right text-sm text-body">
                    {sub.tenure} {sub.tenure === 1 ? 'mo' : 'mos'}
                  </td>
                  <td className="py-2.5 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        sub.paymentHealth === 'good'
                          ? 'bg-success/10 text-success'
                          : sub.paymentHealth === 'warning'
                            ? 'bg-warning/10 text-warning'
                            : 'bg-danger/10 text-danger'
                      }`}
                    >
                      {sub.paymentHealth === 'good' ? 'Current' : sub.paymentHealth === 'warning' ? '1 Missed' : '2+ Missed'}
                    </span>
                  </td>
                  <td className="py-2.5 text-sm text-body">{sub.nextBilling}</td>
                  <td className="py-2.5 text-center text-xs text-muted-foreground capitalize">{sub.billingInterval}</td>
                </tr>
              ))}
              {stats.tableRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                    No active subscriptions
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
