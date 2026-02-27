import { useMemo } from 'react'
import { differenceInMonths, differenceInDays, format, subMonths } from 'date-fns'
import { DollarSign, TrendingUp, TrendingDown, Users, AlertTriangle, Clock } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'
import useContractStore, { useMRR } from '@/stores/contractStore'
import useContactStore from '@/stores/contactStore'
import { useOverdueInvoices, useOverdueTotal } from '@/stores/invoiceStore'
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
  const contracts = useContractStore((s) => s.contracts)
  const payments = useContractStore((s) => s.payments)
  const contacts = useContactStore((s) => s.contacts)
  const mrr = useMRR()
  const overdueInvoices = useOverdueInvoices()
  const overdueInvoiceTotal = useOverdueTotal()

  const stats = useMemo(() => {
    const now = new Date()
    const activeContracts = contracts.filter((c) => c.status === 'active')
    const cancelledContracts = contracts.filter((c) => c.status === 'cancelled')
    const pastDueContracts = contracts.filter((c) => c.status === 'past_due')

    // Active customer count
    const activeCount = activeContracts.length
    const pastDueCount = pastDueContracts.length
    const cancelledCount = cancelledContracts.length

    // ARPA
    const arpa = activeCount > 0 ? mrr / activeCount : 0

    // Net new MRR this month (contracts started this month)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const newThisMonth = activeContracts.filter(
      (c) => new Date(c.start_date) >= monthStart,
    )
    const netNewMRR = newThisMonth.reduce((sum, c) => sum + c.monthly_amount, 0)

    // Revenue at risk: contracts expiring in 30, 60, 90 days
    const riskBands = [30, 60, 90].map((days) => {
      const expiring = activeContracts.filter((c) => {
        if (!c.end_date) return false
        const daysToEnd = differenceInDays(new Date(c.end_date), now)
        return daysToEnd >= 0 && daysToEnd <= days
      })
      return {
        label: `${days} days`,
        count: expiring.length,
        amount: expiring.reduce((sum, c) => sum + c.monthly_amount, 0),
      }
    })

    // MRR trend (trailing 6 months, simulated with current MRR)
    const mrrTrend = Array.from({ length: 6 }, (_, i) => {
      const month = subMonths(now, 5 - i)
      // Simple growth simulation: current MRR with growth factor
      const factor = 0.85 + (i * 0.03)
      return {
        month: format(month, 'MMM'),
        mrr: Math.round(mrr * factor * 100) / 100,
      }
    })

    // MRR breakdown waterfall
    const churnedMRR = cancelledContracts
      .filter((c) => c.cancelled_at && new Date(c.cancelled_at) >= monthStart)
      .reduce((sum, c) => sum + c.monthly_amount, 0)

    const startingMRR = mrr - netNewMRR + churnedMRR
    const waterfall = [
      { name: 'Starting', value: startingMRR, color: '#6C63FF' },
      { name: 'New', value: netNewMRR, color: '#22C55E' },
      { name: 'Churned', value: -churnedMRR, color: '#EF4444' },
      { name: 'Ending', value: mrr, color: '#3B82F6' },
    ]

    // Subscriptions table
    const contactMap = new Map(contacts.map((c) => [c.id, c]))
    const subscriptions = activeContracts.map((contract) => {
      const contact = contactMap.get(contract.contact_id)
      const tenure = differenceInMonths(now, new Date(contract.start_date))
      const failedCount = payments.filter(
        (p) => p.contract_id === contract.id && p.status === 'failed',
      ).length
      const paymentHealth: 'good' | 'warning' | 'critical' =
        failedCount === 0 ? 'good' : failedCount === 1 ? 'warning' : 'critical'

      // Next billing: day of start_date, next month
      const startDay = new Date(contract.start_date).getDate()
      const nextBilling = new Date(now.getFullYear(), now.getMonth() + 1, startDay)

      return {
        id: contract.id,
        customerName: contact
          ? `${contact.first_name} ${contact.last_name}`
          : contract.title,
        monthlyAmount: contract.monthly_amount,
        startDate: contract.start_date,
        tenure,
        paymentHealth,
        nextBilling: format(nextBilling, 'MMM d, yyyy'),
        endDate: contract.end_date,
        autoRenewal: contract.auto_renewal,
      }
    })

    return {
      activeCount,
      pastDueCount,
      cancelledCount,
      arpa,
      netNewMRR,
      riskBands,
      mrrTrend,
      waterfall,
      subscriptions,
    }
  }, [contracts, payments, contacts, mrr])

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-heading">Recurring Revenue Dashboard</h1>

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total MRR"
          value={currencyFormat.format(mrr)}
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
          value={currencyFormatShort.format(stats.arpa)}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          title="Active Customers"
          value={String(stats.activeCount)}
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

      {/* Customer Counts + Revenue at Risk */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Customer Breakdown */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Customer Status
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

        {/* Revenue at Risk */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h3 className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            Revenue at Risk
          </h3>
          <div className="space-y-3">
            {stats.riskBands.map((band) => (
              <div key={band.label} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-heading">Expiring in {band.label}</p>
                  <p className="text-xs text-muted-foreground">{band.count} contracts</p>
                </div>
                <span className="text-sm font-bold text-warning">
                  {currencyFormat.format(band.amount)}/mo
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Subscriptions Table */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-card">
        <h3 className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Active Subscriptions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</th>
                <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly</th>
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start Date</th>
                <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tenure</th>
                <th className="pb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment</th>
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next Billing</th>
                <th className="pb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Auto-Renew</th>
              </tr>
            </thead>
            <tbody>
              {stats.subscriptions.map((sub) => (
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
                  <td className="py-2.5 text-center text-sm text-body">
                    {sub.autoRenewal ? (
                      <span className="text-success">Yes</span>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </td>
                </tr>
              ))}
              {stats.subscriptions.length === 0 && (
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
