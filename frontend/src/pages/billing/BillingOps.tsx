import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, CreditCard, DollarSign, ExternalLink, Loader2, RefreshCw, Search, ShieldCheck, ShieldAlert } from 'lucide-react'
import { format } from 'date-fns'
import { authnetApi, billingApi, invoicesApi, paymentsApi } from '@/lib/api'
import useInvoiceStore from '@/stores/invoiceStore'
import useContractStore from '@/stores/contractStore'
import { openHostedProfilePage } from '@/lib/authnetHostedPage'
// contactStore no longer needed here — accounts are navigated to directly
import type { BillingAccountListResponse, BillingAccountRow } from '@/lib/api'

type ReconcileReport = Awaited<ReturnType<typeof authnetApi.reconcile>>

const pendingHostedKey = 'lsrv_pending_hosted_profile_contact'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const flagStyles: Record<string, string> = {
  current: 'bg-success/10 text-success',
  ready: 'bg-info/10 text-info',
  attention: 'bg-warning/10 text-warning',
  past_due: 'bg-danger/10 text-danger',
  no_card: 'bg-warning/10 text-warning',
  not_started: 'bg-page text-heading',
  cancelled: 'bg-muted text-muted-foreground',
}

const flagLabels: Record<string, string> = {
  current: 'Current',
  ready: 'Ready',
  attention: 'Attention',
  past_due: 'Past Due',
  no_card: 'No Card',
  not_started: 'Not Started',
  cancelled: 'Cancelled',
}

export default function BillingOps() {
  const navigate = useNavigate()
  const [data, setData] = useState<BillingAccountListResponse | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [flagFilter, setFlagFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [rowAction, setRowAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reconciling, setReconciling] = useState(false)
  const [reconcileReport, setReconcileReport] = useState<ReconcileReport | null>(null)
  const [chargeRow, setChargeRow] = useState<string | null>(null)
  const [chargeAmount, setChargeAmount] = useState('')
  const [charging, setCharging] = useState(false)
  const [chargeResult, setChargeResult] = useState<Record<string, { status: string; message: string }>>({})
  const allInvoices = useInvoiceStore((s) => s.invoices)
  const fetchInvoices = useInvoiceStore((s) => s.fetchInvoices)
  const sendInvoice = useInvoiceStore((s) => s.sendInvoice)
  const [showUnsentInvoices, setShowUnsentInvoices] = useState(false)
  const [sendingInvoice, setSendingInvoice] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'accounts' | 'history'>('accounts')
  const allPayments = useContractStore((s) => s.payments)
  const fetchAllPayments = useContractStore((s) => s.fetchPayments)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadAccounts()
    }, 200)

    return () => window.clearTimeout(timeoutId)
  }, [searchInput])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])
  useEffect(() => { fetchAllPayments({}) }, [fetchAllPayments])
  const unpaidInvoices = allInvoices.filter((inv) => inv.status === 'draft' || inv.status === 'sent' || inv.status === 'past_due')

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    function handleFocus() {
      if (window.sessionStorage.getItem(pendingHostedKey)) {
        void loadAccounts()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [searchInput])

  async function loadAccounts() {
    setLoading(true)
    try {
      const response = await billingApi.listAccounts({
        page_size: 100,
        search: searchInput || undefined,
      })
      setData(response)
      setError(null)
    } catch (err) {
      setError(extractError(err, 'Unable to load billing accounts right now.'))
    } finally {
      setLoading(false)
    }
  }

  const rows = useMemo(() => {
    const items = data?.items ?? []
    if (flagFilter === 'all') return items
    return items.filter((item) => item.billing_flag === flagFilter)
  }, [data, flagFilter])

  async function handleManagePaymentMethod(row: BillingAccountRow) {
    setRowAction(row.contact_id)
    try {
      const session = await authnetApi.createHostedProfilePage({
        contact_id: row.contact_id,
        action: row.has_card_on_file ? 'manage' : 'add_payment',
        return_url: `${window.location.origin}/billing`,
      })
      window.sessionStorage.setItem(pendingHostedKey, row.contact_id)
      openHostedProfilePage(session)
    } catch (err) {
      setError(extractError(err, 'Unable to open the secure payment method form.'))
    } finally {
      setRowAction(null)
    }
  }

  function openAccount(contactId: string) {
    navigate(`/accounts/${contactId}`)
  }

  async function handleReconcile() {
    setReconciling(true)
    setReconcileReport(null)
    try {
      const report = await authnetApi.reconcile()
      setReconcileReport(report)
      if (report.corrections_applied > 0) {
        void loadAccounts()
      }
      setError(null)
    } catch (err) {
      setError(extractError(err, 'Reconciliation failed.'))
    } finally {
      setReconciling(false)
    }
  }

  async function handleInlineCharge(contactId: string) {
    const amt = parseFloat(chargeAmount)
    if (!amt || amt <= 0) return
    setCharging(true)
    try {
      const result = await authnetApi.charge({ contact_id: contactId, amount: amt, description: 'Payment' })
      if (result.status === 'succeeded') {
        setChargeResult((prev) => ({ ...prev, [contactId]: { status: 'success', message: `Approved: ${currencyFormat.format(result.amount)}` } }))
        setChargeRow(null)
        setChargeAmount('')
        void loadAccounts()
      } else {
        setChargeResult((prev) => ({ ...prev, [contactId]: { status: 'error', message: result.failure_message || 'Charge declined' } }))
      }
    } catch (e) {
      setChargeResult((prev) => ({ ...prev, [contactId]: { status: 'error', message: e instanceof Error ? e.message : 'Charge failed' } }))
    } finally {
      setCharging(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-lg font-bold text-heading">Billing</h1>
          <div className="mt-2 flex gap-1">
            <button
              onClick={() => setActiveTab('accounts')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${activeTab === 'accounts' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-heading hover:bg-page'}`}
            >
              Accounts
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${activeTab === 'history' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-heading hover:bg-page'}`}
            >
              History & Invoices
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search customer or company"
              className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-heading outline-none focus:border-primary sm:w-72"
            />
          </label>
          <select
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value)}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-heading outline-none focus:border-primary"
          >
            <option value="all">All Flags</option>
            <option value="current">Current</option>
            <option value="ready">Ready</option>
            <option value="attention">Attention</option>
            <option value="past_due">Past Due</option>
            <option value="no_card">No Card</option>
            <option value="not_started">Not Started</option>
          </select>
          <button
            onClick={loadAccounts}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-heading transition-colors hover:bg-page"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={handleReconcile}
            disabled={reconciling}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {reconciling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            Reconcile Gateway
          </button>
        </div>
      </div>

      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-page/60">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(() => {
                    // Combine payments and invoices into a single timeline
                    type HistoryItem = { id: string; realId: string; contactId: string; date: string; type: 'payment' | 'invoice'; description: string; amount: number; status: string }
                    const items: HistoryItem[] = []

                    allPayments.forEach((p) => {
                      items.push({
                        id: `p-${p.id}`,
                        realId: p.id,
                        contactId: p.contact_id,
                        date: p.payment_date || p.created_at,
                        type: 'payment',
                        description: p.payment_method_last4 ? `Card •••• ${p.payment_method_last4}` : 'Card on file',
                        amount: p.amount,
                        status: p.status,
                      })
                    })

                    allInvoices.forEach((inv) => {
                      items.push({
                        id: `i-${inv.id}`,
                        realId: inv.id,
                        contactId: inv.contact_id,
                        date: inv.invoice_date || inv.created_at,
                        type: 'invoice',
                        description: inv.invoice_number,
                        amount: inv.total,
                        status: inv.status,
                      })
                    })

                    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

                    if (items.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                            No billing history yet.
                          </td>
                        </tr>
                      )
                    }

                    return items.map((item) => {
                      const statusColors: Record<string, string> = {
                        succeeded: 'bg-success/10 text-success',
                        paid: 'bg-success/10 text-success',
                        failed: 'bg-danger/10 text-danger',
                        past_due: 'bg-danger/10 text-danger',
                        sent: 'bg-info/10 text-info',
                        draft: 'bg-muted text-muted-foreground',
                        refunded: 'bg-warning/10 text-warning',
                        void: 'bg-muted text-muted-foreground',
                      }
                      return (
                        <tr key={item.id} className="align-top">
                          <td className="px-4 py-3 text-muted-foreground">
                            {format(new Date(item.date), 'MMM d, yyyy')}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.type === 'payment' ? 'bg-primary/10 text-primary' : 'bg-page text-heading'}`}>
                              {item.type === 'payment' ? 'Payment' : 'Invoice'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-heading">
                            {item.description}
                          </td>
                          <td className="px-4 py-3 font-medium text-heading">
                            {currencyFormat.format(item.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColors[item.status] ?? 'bg-muted text-muted-foreground'}`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'accounts' && error && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Invoices to Send */}
      {activeTab === 'accounts' && unpaidInvoices.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 shadow-card">
          <button
            onClick={() => setShowUnsentInvoices(!showUnsentInvoices)}
            className="flex w-full items-center justify-between"
          >
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              {unpaidInvoices.length} Unpaid Invoice{unpaidInvoices.length !== 1 ? 's' : ''}
            </h3>
            <span className="text-xs text-muted-foreground">{showUnsentInvoices ? 'Hide' : 'Show'}</span>
          </button>
          {showUnsentInvoices && (
            <div className="mt-3 space-y-2">
              {unpaidInvoices.map((inv) => {
                const statusLabel = inv.status === 'draft' ? 'Draft' : inv.status === 'past_due' ? 'Past Due' : 'Sent'
                const statusColor = inv.status === 'past_due' ? 'bg-danger/10 text-danger' : inv.status === 'draft' ? 'bg-muted text-muted-foreground' : 'bg-info/10 text-info'
                return (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg bg-white border border-border px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-xs font-medium text-heading">{inv.invoice_number}</p>
                        <p className="text-[10px] text-muted-foreground">{currencyFormat.format(inv.total)}</p>
                      </div>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${statusColor}`}>{statusLabel}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {inv.status === 'draft' && (
                        <button
                          onClick={async () => {
                            setSendingInvoice(inv.id)
                            try { await sendInvoice(inv.id) } finally { setSendingInvoice(null) }
                          }}
                          disabled={sendingInvoice === inv.id}
                          className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                        >
                          {sendingInvoice === inv.id ? 'Sending...' : 'Send'}
                        </button>
                      )}
                      {(inv.status === 'sent' || inv.status === 'past_due') && (
                        <button
                          onClick={async () => {
                            setSendingInvoice(inv.id)
                            try {
                              await authnetApi.charge({
                                contact_id: inv.contact_id,
                                amount: inv.total,
                                description: `Invoice ${inv.invoice_number}`,
                              })
                              await fetchInvoices()
                              void loadAccounts()
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'Charge failed')
                            } finally { setSendingInvoice(null) }
                          }}
                          disabled={sendingInvoice === inv.id}
                          className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                        >
                          {sendingInvoice === inv.id ? '...' : `Charge ${currencyFormat.format(inv.total)}`}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'accounts' && reconcileReport && (
        <div className="rounded-xl border border-border bg-white p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-heading">
              <ShieldAlert className="h-4 w-4 text-primary" />
              Gateway Reconciliation Report
            </h3>
            <span className="text-xs text-muted-foreground">
              {reconcileReport.date_from} to {reconcileReport.date_to}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-4">
            <div className="text-center">
              <p className="text-lg font-bold text-heading">{reconcileReport.total_gateway_transactions}</p>
              <p className="text-xs text-muted-foreground">Gateway Transactions</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-success">{reconcileReport.matched}</p>
              <p className="text-xs text-muted-foreground">Matched</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold ${reconcileReport.mismatches.length > 0 ? 'text-danger' : 'text-heading'}`}>
                {reconcileReport.mismatches.length}
              </p>
              <p className="text-xs text-muted-foreground">Mismatches Fixed</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold ${reconcileReport.corrections_applied > 0 ? 'text-warning' : 'text-heading'}`}>
                {reconcileReport.corrections_applied}
              </p>
              <p className="text-xs text-muted-foreground">Corrections Applied</p>
            </div>
          </div>

          {reconcileReport.mismatches.length === 0 && reconcileReport.missing_gateway.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 px-4 py-3 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              All payments match the gateway. Billing data is trustworthy.
            </div>
          )}

          {reconcileReport.mismatches.length > 0 && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Status Mismatches (Auto-Corrected)</h4>
              <div className="space-y-1">
                {reconcileReport.mismatches.map((m) => (
                  <div key={m.trans_id} className="flex items-center justify-between rounded-lg border border-warning/20 bg-warning/5 px-3 py-2 text-xs">
                    <span className="font-mono text-muted-foreground">#{m.trans_id}</span>
                    <span>${m.amount.toFixed(2)}</span>
                    <span>
                      <span className="text-danger">{m.local_status}</span>
                      {' → '}
                      <span className="text-success">{m.corrected_to}</span>
                    </span>
                    <span className="text-muted-foreground">Gateway: {m.gateway_status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reconcileReport.missing_gateway.length > 0 && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">In CRM But Not In Gateway</h4>
              <div className="space-y-1">
                {reconcileReport.missing_gateway.map((m) => (
                  <div key={m.trans_id} className="flex items-center justify-between rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-xs">
                    <span className="font-mono text-muted-foreground">#{m.trans_id}</span>
                    <span>${m.amount.toFixed(2)}</span>
                    <span className="text-danger">{m.local_status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'accounts' && <><div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard
          label="Monitoring MRR"
          value={currencyFormat.format(data?.total_mrr ?? 0)}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <SummaryCard
          label="Past Due"
          value={String(data?.past_due_count ?? 0)}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <SummaryCard
          label="Missing Card"
          value={String(data?.missing_card_count ?? 0)}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <SummaryCard
          label="Accounts in View"
          value={String(rows.length)}
          icon={<RefreshCw className="h-4 w-4" />}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-page/60">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Billing Flag</th>
                <th className="px-4 py-3">Card on File</th>
                <th className="px-4 py-3">Monitoring</th>
                <th className="px-4 py-3">Next Billing</th>
                <th className="px-4 py-3">Last Payment</th>
                <th className="px-4 py-3">Lifetime Revenue</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading billing accounts...
                    </span>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No billing accounts match this view yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.contact_id} className="align-top">
                    <td className="px-4 py-4">
                      <div>
                        <button
                          onClick={() => openAccount(row.contact_id)}
                          className="text-left font-semibold text-heading transition-colors hover:text-primary"
                        >
                          {row.customer_name}
                        </button>
                        {row.company && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{row.company}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.email || row.phone || 'No contact info'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${flagStyles[row.billing_flag] ?? flagStyles.not_started}`}>
                        {flagLabels[row.billing_flag] ?? row.billing_flag}
                      </span>
                      {row.failed_payment_count > 0 && (
                        <p className="mt-1 text-xs text-danger">{row.failed_payment_count} failed payment{row.failed_payment_count > 1 ? 's' : ''}</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {row.has_card_on_file ? (
                        <div>
                          <p className="font-medium text-heading">
                            {row.payment_method_type === 'bank_account'
                              ? `ACH •••• ${row.payment_method_last4 ?? '----'}`
                              : `${(row.payment_method_brand ?? 'Card').toUpperCase()} •••• ${row.payment_method_last4 ?? '----'}`}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">Stored on Authorize.net</p>
                        </div>
                      ) : row.has_billing_profile ? (
                        <div>
                          <p className="font-medium text-warning">No card saved</p>
                          <p className="mt-1 text-xs text-muted-foreground">Profile exists</p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-medium text-muted-foreground">Not started</p>
                          <p className="mt-1 text-xs text-muted-foreground">No billing profile</p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-heading">
                        {row.monthly_amount ? currencyFormat.format(row.monthly_amount) : 'N/A'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.subscription_status ? row.subscription_status.replace('_', ' ') : row.contract_title ?? 'No monitoring plan'}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {row.next_billing_date ? format(new Date(row.next_billing_date), 'MMM d, yyyy') : 'N/A'}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-heading">
                        {row.last_payment_amount ? currencyFormat.format(row.last_payment_amount) : 'N/A'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.last_payment_date ? format(new Date(row.last_payment_date), 'MMM d, yyyy') : 'No payment yet'}
                      </p>
                    </td>
                    <td className="px-4 py-4 font-medium text-heading">
                      {currencyFormat.format(row.lifetime_revenue)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleManagePaymentMethod(row)}
                          disabled={rowAction === row.contact_id}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-heading transition-colors hover:bg-page disabled:opacity-50"
                        >
                          {rowAction === row.contact_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                          {row.has_card_on_file ? 'Manage Payment' : 'Add Payment'}
                        </button>
                        <button
                          onClick={() => openAccount(row.contact_id)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
                        >
                          Open Account
                        </button>
                        {row.has_card_on_file && chargeRow !== row.contact_id && (
                          <button
                            onClick={() => { setChargeRow(row.contact_id); setChargeAmount(''); setChargeResult((prev) => { const next = { ...prev }; delete next[row.contact_id]; return next }) }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                          >
                            <DollarSign className="h-3 w-3" />
                            Charge
                          </button>
                        )}
                        {chargeRow === row.contact_id && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={chargeAmount}
                              onChange={(e) => setChargeAmount(e.target.value)}
                              placeholder="$0.00"
                              autoFocus
                              className="w-20 rounded border border-border px-2 py-1 text-[11px] text-heading outline-none focus:border-primary"
                            />
                            <button
                              onClick={() => handleInlineCharge(row.contact_id)}
                              disabled={charging || !chargeAmount || parseFloat(chargeAmount) <= 0}
                              className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                            >
                              {charging ? '...' : 'Go'}
                            </button>
                            <button
                              onClick={() => { setChargeRow(null); setChargeAmount('') }}
                              className="text-[10px] text-muted-foreground hover:text-heading"
                            >
                              x
                            </button>
                          </div>
                        )}
                        {chargeResult[row.contact_id] && (
                          <div className={`rounded px-2 py-1 text-[10px] ${
                            chargeResult[row.contact_id].status === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                          }`}>
                            {chargeResult[row.contact_id].message}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>}
    </div>
  )
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-xl font-bold text-heading">{value}</p>
        </div>
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          {icon}
        </div>
      </div>
    </div>
  )
}

function extractError(err: unknown, fallback: string) {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'data' in err.response &&
    err.response.data &&
    typeof err.response.data === 'object' &&
    'detail' in err.response.data
  ) {
    return String((err.response as { data: { detail: unknown } }).data.detail)
  }

  if (err instanceof Error && err.message) return err.message
  return fallback
}
