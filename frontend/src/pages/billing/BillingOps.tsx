import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, CreditCard, DollarSign, ExternalLink, FileText, Loader2, RefreshCw, Search, Send, ShieldAlert, X } from 'lucide-react'
import { format } from 'date-fns'
import { authnetApi, billingApi, invoicesApi } from '@/lib/api'
import useInvoiceStore from '@/stores/invoiceStore'
import useContractStore from '@/stores/contractStore'
import useContactStore from '@/stores/contactStore'
import { openHostedProfilePage } from '@/lib/authnetHostedPage'
import type { Invoice } from '@/types/invoice'
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from '@/types/invoice'
import type { BillingAccountListResponse, BillingAccountRow } from '@/lib/api'

type ReconcileReport = Awaited<ReturnType<typeof authnetApi.reconcile>>

const pendingHostedKey = 'lsrv_pending_hosted_profile_contact'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export default function BillingOps() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'action' | 'invoices' | 'payments' | 'accounts'>('action')
  const [error, setError] = useState<string | null>(null)

  // Billing accounts
  const [billingData, setBillingData] = useState<BillingAccountListResponse | null>(null)
  const [billingLoading, setBillingLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')

  // Invoices
  const allInvoices = useInvoiceStore((s) => s.invoices)
  const fetchInvoices = useInvoiceStore((s) => s.fetchInvoices)
  const sendInvoice = useInvoiceStore((s) => s.sendInvoice)
  const markPaid = useInvoiceStore((s) => s.markPaid)
  const voidInvoice = useInvoiceStore((s) => s.voidInvoice)
  const [sendingInvoice, setSendingInvoice] = useState<string | null>(null)
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null)

  // Payments
  const allPayments = useContractStore((s) => s.payments)
  const fetchAllPayments = useContractStore((s) => s.fetchPayments)

  // Contacts for name resolution
  const contacts = useContactStore((s) => s.contacts)
  const fetchContacts = useContactStore((s) => s.fetchContacts)

  // Quick charge
  const [chargeContactId, setChargeContactId] = useState('')
  const [chargeAmount, setChargeAmount] = useState('')
  const [chargeDesc, setChargeDesc] = useState('')
  const [charging, setCharging] = useState(false)
  const [chargeResult, setChargeResult] = useState<{ status: string; message: string } | null>(null)

  // Reconciliation
  const [reconciling, setReconciling] = useState(false)
  const [reconcileReport, setReconcileReport] = useState<ReconcileReport | null>(null)

  useEffect(() => { fetchInvoices() }, [fetchInvoices])
  useEffect(() => { fetchAllPayments({}) }, [fetchAllPayments])
  useEffect(() => { fetchContacts() }, [fetchContacts])
  useEffect(() => { loadAccounts() }, [])

  const contactMap = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts])
  function contactName(contactId: string) {
    const c = contactMap.get(contactId)
    return c ? `${c.first_name} ${c.last_name}` : 'Unknown'
  }

  async function loadAccounts() {
    setBillingLoading(true)
    try {
      const response = await billingApi.listAccounts({ page_size: 100, search: searchInput || undefined })
      setBillingData(response)
      setError(null)
    } catch (err) {
      setError(extractError(err, 'Unable to load billing data.'))
    } finally {
      setBillingLoading(false)
    }
  }

  // Action queue: unpaid invoices + accounts needing attention
  const unpaidInvoices = allInvoices.filter((inv) => inv.status === 'draft' || inv.status === 'sent' || inv.status === 'past_due')
  const pastDueInvoices = allInvoices.filter((inv) => inv.status === 'past_due')
  const draftInvoices = allInvoices.filter((inv) => inv.status === 'draft')
  const sentInvoices = allInvoices.filter((inv) => inv.status === 'sent')
  const paidInvoices = allInvoices.filter((inv) => inv.status === 'paid')

  const unpaidTotal = unpaidInvoices.reduce((sum, inv) => sum + inv.amount_due, 0)
  const mrr = billingData?.total_mrr ?? 0
  const pastDueCount = billingData?.past_due_count ?? 0

  async function handleQuickCharge() {
    if (!chargeContactId || !chargeAmount) return
    const amt = parseFloat(chargeAmount)
    if (!amt || amt <= 0) return
    setCharging(true)
    setChargeResult(null)
    try {
      const result = await authnetApi.charge({
        contact_id: chargeContactId,
        amount: amt,
        description: chargeDesc || 'Payment',
      })
      if (result.status === 'succeeded') {
        setChargeResult({ status: 'success', message: `Approved: ${currencyFormat.format(result.amount)}` })
        setChargeAmount('')
        setChargeDesc('')
        setChargeContactId('')
        fetchInvoices()
        fetchAllPayments({})
        loadAccounts()
      } else {
        setChargeResult({ status: 'error', message: result.failure_message || 'Charge declined' })
      }
    } catch (e) {
      setChargeResult({ status: 'error', message: e instanceof Error ? e.message : 'Charge failed' })
    } finally {
      setCharging(false)
    }
  }

  async function handleReconcile() {
    setReconciling(true)
    setReconcileReport(null)
    try {
      const report = await authnetApi.reconcile()
      setReconcileReport(report)
      if (report.corrections_applied > 0) loadAccounts()
      setError(null)
    } catch (err) {
      setError(extractError(err, 'Reconciliation failed.'))
    } finally {
      setReconciling(false)
    }
  }

  async function handleInvoiceAction(inv: Invoice, action: 'send' | 'charge' | 'mark_paid' | 'void') {
    setSendingInvoice(inv.id)
    try {
      if (action === 'send') {
        await sendInvoice(inv.id)
      } else if (action === 'charge') {
        await authnetApi.charge({
          contact_id: inv.contact_id,
          amount: inv.amount_due,
          description: `Invoice ${inv.invoice_number}`,
        })
        await fetchInvoices()
        loadAccounts()
      } else if (action === 'mark_paid') {
        await markPaid(inv.id)
      } else if (action === 'void') {
        await voidInvoice(inv.id)
      }
    } catch (err) {
      setError(extractError(err, 'Action failed.'))
    } finally {
      setSendingInvoice(null)
    }
  }

  // Customers with card on file for quick charge dropdown
  const chargeableCustomers = useMemo(() => {
    return (billingData?.items ?? []).filter((r) => r.has_card_on_file)
  }, [billingData])

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Monitoring MRR" value={currencyFormat.format(mrr)} color="text-primary" />
        <KpiCard label="Outstanding" value={currencyFormat.format(unpaidTotal)} color={unpaidTotal > 0 ? 'text-warning' : 'text-heading'} />
        <KpiCard label="Past Due" value={String(pastDueInvoices.length)} color={pastDueInvoices.length > 0 ? 'text-danger' : 'text-heading'} />
        <KpiCard label="Collected (Paid)" value={String(paidInvoices.length)} color="text-success" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {(['action', 'invoices', 'payments', 'accounts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-heading'
            }`}
          >
            {tab === 'action' ? 'Action Queue' : tab === 'invoices' ? 'Invoices' : tab === 'payments' ? 'Payments' : 'Accounts'}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleReconcile}
            disabled={reconciling}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-heading hover:bg-page disabled:opacity-50"
          >
            {reconciling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
            Sync Gateway
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-danger/20 bg-danger/5 px-4 py-2.5 text-sm text-danger">
          {error}
          <button onClick={() => setError(null)} className="text-danger/60 hover:text-danger"><X className="h-4 w-4" /></button>
        </div>
      )}

      {reconcileReport && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3 shadow-card text-sm">
          {reconcileReport.mismatches.length === 0 && reconcileReport.missing_gateway.length === 0 ? (
            <><CheckCircle2 className="h-4 w-4 text-success" /><span className="text-success">All payments match gateway. Data is clean.</span></>
          ) : (
            <><ShieldAlert className="h-4 w-4 text-warning" /><span className="text-heading">{reconcileReport.corrections_applied} corrections applied, {reconcileReport.mismatches.length} mismatches fixed.</span></>
          )}
          <button onClick={() => setReconcileReport(null)} className="ml-auto text-muted-foreground hover:text-heading"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ── ACTION QUEUE ──────────────────────────────── */}
      {activeTab === 'action' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {/* Past due */}
            {pastDueInvoices.length > 0 && (
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-danger mb-2">
                  <AlertTriangle className="h-3.5 w-3.5" /> Past Due ({pastDueInvoices.length})
                </h3>
                <div className="space-y-2">
                  {pastDueInvoices.map((inv) => (
                    <InvoiceRow key={inv.id} inv={inv} contactName={contactName(inv.contact_id)} sending={sendingInvoice === inv.id}
                      onView={() => setViewingInvoice(inv)}
                      onCharge={() => handleInvoiceAction(inv, 'charge')}
                      onOpen={() => navigate(`/accounts/${inv.contact_id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Sent / awaiting payment */}
            {sentInvoices.length > 0 && (
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-info mb-2">
                  <Send className="h-3.5 w-3.5" /> Sent - Awaiting Payment ({sentInvoices.length})
                </h3>
                <div className="space-y-2">
                  {sentInvoices.map((inv) => (
                    <InvoiceRow key={inv.id} inv={inv} contactName={contactName(inv.contact_id)} sending={sendingInvoice === inv.id}
                      onView={() => setViewingInvoice(inv)}
                      onCharge={() => handleInvoiceAction(inv, 'charge')}
                      onOpen={() => navigate(`/accounts/${inv.contact_id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Drafts needing to be sent */}
            {draftInvoices.length > 0 && (
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <FileText className="h-3.5 w-3.5" /> Drafts ({draftInvoices.length})
                </h3>
                <div className="space-y-2">
                  {draftInvoices.map((inv) => (
                    <InvoiceRow key={inv.id} inv={inv} contactName={contactName(inv.contact_id)} sending={sendingInvoice === inv.id}
                      onView={() => setViewingInvoice(inv)}
                      onSend={() => handleInvoiceAction(inv, 'send')}
                      onOpen={() => navigate(`/accounts/${inv.contact_id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {unpaidInvoices.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 className="h-8 w-8 text-success mb-3" />
                <p className="text-sm font-medium text-heading">All caught up</p>
                <p className="text-xs text-muted-foreground mt-1">No outstanding invoices to collect.</p>
              </div>
            )}
          </div>

          {/* Quick Charge sidebar */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-card h-fit">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-heading mb-4">
              <DollarSign className="h-3.5 w-3.5" /> Quick Charge
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Customer</label>
                <select
                  value={chargeContactId}
                  onChange={(e) => setChargeContactId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-heading outline-none focus:border-primary"
                >
                  <option value="">Select customer...</option>
                  {chargeableCustomers.map((row) => (
                    <option key={row.contact_id} value={row.contact_id}>
                      {row.customer_name} ({(row.payment_method_brand ?? 'Card').toUpperCase()} ****{row.payment_method_last4})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Amount</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-border bg-white py-2 pl-7 pr-3 text-sm text-heading outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Description</label>
                <input
                  type="text"
                  value={chargeDesc}
                  onChange={(e) => setChargeDesc(e.target.value)}
                  placeholder="Payment, Equipment, etc."
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-heading outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={handleQuickCharge}
                disabled={charging || !chargeContactId || !chargeAmount || parseFloat(chargeAmount) <= 0}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {charging ? 'Processing...' : `Charge ${chargeAmount ? currencyFormat.format(parseFloat(chargeAmount) || 0) : '$0.00'}`}
              </button>
              {chargeResult && (
                <div className={`rounded-lg px-3 py-2 text-xs ${
                  chargeResult.status === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                }`}>
                  {chargeResult.message}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── INVOICES TAB ─────────────────────────────── */}
      {activeTab === 'invoices' && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-page/60">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allInvoices.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No invoices yet.</td></tr>
                ) : (
                  [...allInvoices]
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((inv) => (
                      <tr key={inv.id} className="hover:bg-page/30 cursor-pointer" onClick={() => setViewingInvoice(inv)}>
                        <td className="px-4 py-3 font-medium text-heading">{inv.invoice_number}</td>
                        <td className="px-4 py-3">
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/accounts/${inv.contact_id}`) }} className="text-heading hover:text-primary">
                            {contactName(inv.contact_id)}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{format(new Date(inv.invoice_date), 'MMM d, yyyy')}</td>
                        <td className="px-4 py-3 text-muted-foreground">{format(new Date(inv.due_date), 'MMM d, yyyy')}</td>
                        <td className="px-4 py-3 text-right font-medium text-heading">{currencyFormat.format(inv.total)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${INVOICE_STATUS_COLORS[inv.status]}`}>
                            {INVOICE_STATUS_LABELS[inv.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            {inv.status === 'draft' && (
                              <button onClick={() => handleInvoiceAction(inv, 'send')} disabled={sendingInvoice === inv.id}
                                className="rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-white hover:bg-primary-hover disabled:opacity-50">
                                {sendingInvoice === inv.id ? '...' : 'Send'}
                              </button>
                            )}
                            {(inv.status === 'sent' || inv.status === 'past_due') && (
                              <button onClick={() => handleInvoiceAction(inv, 'charge')} disabled={sendingInvoice === inv.id}
                                className="rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-white hover:bg-primary-hover disabled:opacity-50">
                                {sendingInvoice === inv.id ? '...' : 'Charge'}
                              </button>
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
      )}

      {/* ── PAYMENTS TAB ─────────────────────────────── */}
      {activeTab === 'payments' && (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-page/60">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allPayments.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No payments recorded yet.</td></tr>
              ) : (
                [...allPayments]
                  .sort((a, b) => new Date(b.payment_date || b.created_at).getTime() - new Date(a.payment_date || a.created_at).getTime())
                  .map((p) => {
                    const statusColor = p.status === 'succeeded' ? 'bg-success/10 text-success' : p.status === 'failed' ? 'bg-danger/10 text-danger' : 'bg-muted text-muted-foreground'
                    return (
                      <tr key={p.id} className="hover:bg-page/30 cursor-pointer" onClick={() => navigate(`/accounts/${p.contact_id}`)}>
                        <td className="px-4 py-3 text-muted-foreground">{format(new Date(p.payment_date || p.created_at), 'MMM d, yyyy h:mm a')}</td>
                        <td className="px-4 py-3 font-medium text-heading">{contactName(p.contact_id)}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {p.payment_method_last4 ? `Card ending ${p.payment_method_last4}` : 'Card on file'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-heading">{currencyFormat.format(p.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor}`}>
                            {p.status === 'succeeded' ? 'Approved' : p.status === 'failed' ? 'Declined' : p.status}
                          </span>
                          {p.failure_message && <p className="mt-0.5 text-[10px] text-danger">{p.failure_message}</p>}
                        </td>
                      </tr>
                    )
                  })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ACCOUNTS TAB ─────────────────────────────── */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); setTimeout(loadAccounts, 300) }}
                placeholder="Search customer..."
                className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-heading outline-none focus:border-primary"
              />
            </div>
            <button onClick={loadAccounts} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-heading hover:bg-page">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-page/60">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Card on File</th>
                  <th className="px-4 py-3">Monitoring</th>
                  <th className="px-4 py-3">Last Payment</th>
                  <th className="px-4 py-3">Lifetime</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {billingLoading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading...</td></tr>
                ) : (billingData?.items ?? []).length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No billing accounts yet.</td></tr>
                ) : (
                  (billingData?.items ?? []).map((row) => (
                    <tr key={row.contact_id} className="hover:bg-page/30">
                      <td className="px-4 py-3">
                        <button onClick={() => navigate(`/accounts/${row.contact_id}`)} className="text-left font-medium text-heading hover:text-primary">
                          {row.customer_name}
                        </button>
                        {row.company && <p className="text-[10px] text-muted-foreground">{row.company}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {row.has_card_on_file ? (
                          <span className="text-heading">{(row.payment_method_brand ?? 'Card').toUpperCase()} ****{row.payment_method_last4}</span>
                        ) : (
                          <span className="text-warning">No card</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.monthly_amount ? (
                          <span className="font-medium text-heading">{currencyFormat.format(row.monthly_amount)}/mo</span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.last_payment_date ? (
                          <span>{currencyFormat.format(row.last_payment_amount ?? 0)} on {format(new Date(row.last_payment_date), 'MMM d')}</span>
                        ) : '--'}
                      </td>
                      <td className="px-4 py-3 font-medium text-heading">{currencyFormat.format(row.lifetime_revenue)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => navigate(`/accounts/${row.contact_id}`)}
                            className="rounded bg-primary px-2.5 py-1 text-[10px] font-medium text-white hover:bg-primary-hover">
                            Open
                          </button>
                          {row.has_card_on_file && (
                            <button onClick={() => { setActiveTab('action'); setChargeContactId(row.contact_id) }}
                              className="rounded border border-primary/30 px-2.5 py-1 text-[10px] font-medium text-primary hover:bg-primary/5">
                              Charge
                            </button>
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
      )}

      {/* ── INVOICE DETAIL MODAL ─────────────────────── */}
      {viewingInvoice && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setViewingInvoice(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-modal overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-heading">Invoice {viewingInvoice.invoice_number}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{contactName(viewingInvoice.contact_id)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${INVOICE_STATUS_COLORS[viewingInvoice.status]}`}>
                    {INVOICE_STATUS_LABELS[viewingInvoice.status]}
                  </span>
                  <button onClick={() => setViewingInvoice(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-page hover:text-heading">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4">
                {/* Dates */}
                <div className="flex gap-6 text-xs">
                  <div><span className="text-muted-foreground">Issued</span><p className="font-medium text-heading">{format(new Date(viewingInvoice.invoice_date), 'MMM d, yyyy')}</p></div>
                  <div><span className="text-muted-foreground">Due</span><p className="font-medium text-heading">{format(new Date(viewingInvoice.due_date), 'MMM d, yyyy')}</p></div>
                  {viewingInvoice.paid_at && <div><span className="text-muted-foreground">Paid</span><p className="font-medium text-success">{format(new Date(viewingInvoice.paid_at), 'MMM d, yyyy')}</p></div>}
                </div>

                {/* Line items */}
                {viewingInvoice.line_items && viewingInvoice.line_items.length > 0 && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-page/50 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-center w-12">Qty</th>
                          <th className="px-3 py-2 text-right w-20">Price</th>
                          <th className="px-3 py-2 text-right w-20">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingInvoice.line_items.map((line, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-3 py-2 text-heading">{line.description}</td>
                            <td className="px-3 py-2 text-center text-muted-foreground">{line.quantity}</td>
                            <td className="px-3 py-2 text-right text-heading">{currencyFormat.format(line.unit_price)}</td>
                            <td className="px-3 py-2 text-right font-medium text-heading">{currencyFormat.format(line.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Totals */}
                <div className="rounded-lg bg-page/50 px-4 py-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-heading">{currencyFormat.format(viewingInvoice.subtotal)}</span>
                  </div>
                  {viewingInvoice.tax_amount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="text-heading">{currencyFormat.format(viewingInvoice.tax_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold border-t border-border pt-1.5">
                    <span className="text-heading">Total</span>
                    <span className="text-heading">{currencyFormat.format(viewingInvoice.total)}</span>
                  </div>
                  {viewingInvoice.amount_paid > 0 && viewingInvoice.amount_paid < viewingInvoice.total && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-success">Paid</span>
                        <span className="text-success">-{currencyFormat.format(viewingInvoice.amount_paid)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-danger">Balance Due</span>
                        <span className="text-danger">{currencyFormat.format(viewingInvoice.amount_due)}</span>
                      </div>
                    </>
                  )}
                </div>

                {viewingInvoice.memo && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Memo</p>
                    <p className="text-xs text-body">{viewingInvoice.memo}</p>
                  </div>
                )}
              </div>

              {/* Actions footer */}
              <div className="border-t border-border px-5 py-3 flex items-center gap-2">
                {viewingInvoice.status === 'draft' && (
                  <button onClick={() => { handleInvoiceAction(viewingInvoice, 'send'); setViewingInvoice(null) }}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-hover">
                    Send Invoice
                  </button>
                )}
                {(viewingInvoice.status === 'sent' || viewingInvoice.status === 'past_due') && (
                  <>
                    <button onClick={() => { handleInvoiceAction(viewingInvoice, 'charge'); setViewingInvoice(null) }}
                      className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-hover">
                      Charge {currencyFormat.format(viewingInvoice.amount_due)}
                    </button>
                    <button onClick={() => { handleInvoiceAction(viewingInvoice, 'mark_paid'); setViewingInvoice(null) }}
                      className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-heading hover:bg-page">
                      Mark Paid
                    </button>
                  </>
                )}
                {viewingInvoice.status !== 'void' && viewingInvoice.status !== 'paid' && (
                  <button onClick={() => { handleInvoiceAction(viewingInvoice, 'void'); setViewingInvoice(null) }}
                    className="ml-auto rounded-lg border border-border px-4 py-2 text-xs font-medium text-danger/70 hover:text-danger hover:border-danger/30">
                    Void
                  </button>
                )}
                <button onClick={() => navigate(`/accounts/${viewingInvoice.contact_id}`)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-heading hover:bg-page">
                  Open Account
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────── */

function InvoiceRow({ inv, contactName, sending, onView, onCharge, onSend, onOpen }: {
  inv: Invoice
  contactName: string
  sending: boolean
  onView: () => void
  onCharge?: () => void
  onSend?: () => void
  onOpen: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3 shadow-card">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onView} className="min-w-0">
          <p className="text-sm font-medium text-heading truncate">{inv.invoice_number}</p>
          <p className="text-xs text-muted-foreground">{contactName}</p>
        </button>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className="text-sm font-bold text-heading">{currencyFormat.format(inv.amount_due)}</p>
          <p className="text-[10px] text-muted-foreground">due {format(new Date(inv.due_date), 'MMM d')}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onView} className="rounded border border-border px-2.5 py-1 text-[10px] font-medium text-heading hover:bg-page">View</button>
          {onSend && (
            <button onClick={onSend} disabled={sending}
              className="rounded bg-primary px-2.5 py-1 text-[10px] font-medium text-white hover:bg-primary-hover disabled:opacity-50">
              {sending ? '...' : 'Send'}
            </button>
          )}
          {onCharge && (
            <button onClick={onCharge} disabled={sending}
              className="rounded bg-primary px-2.5 py-1 text-[10px] font-medium text-white hover:bg-primary-hover disabled:opacity-50">
              {sending ? '...' : 'Charge'}
            </button>
          )}
          <button onClick={onOpen} className="rounded border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:text-heading">
            Account
          </button>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1.5 text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function extractError(err: unknown, fallback: string) {
  if (err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response && err.response.data && typeof err.response.data === 'object' && 'detail' in err.response.data) {
    return String((err.response as { data: { detail: unknown } }).data.detail)
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}
