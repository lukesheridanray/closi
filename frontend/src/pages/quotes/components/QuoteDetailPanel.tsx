import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Send, CheckCircle2, FileText, DollarSign, XCircle, RefreshCw, Loader2 } from 'lucide-react'
import type { Quote } from '@/types/quote'
import { QUOTE_STATUS_LABELS } from '@/types/quote'
import useQuoteStore from '@/stores/quoteStore'
import useContactStore from '@/stores/contactStore'
import { authnetApi, quotesApi, usersApi } from '@/lib/api'
import BillingActions from '@/components/shared/BillingActions'
import type { User } from '@/lib/api'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-info/10 text-info',
  accepted: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
  expired: 'bg-warning/10 text-warning',
}

interface QuoteDetailPanelProps {
  quote: Quote
}

export default function QuoteDetailPanel({ quote }: QuoteDetailPanelProps) {
  const sendQuote = useQuoteStore((s) => s.sendQuote)
  const acceptQuote = useQuoteStore((s) => s.acceptQuote)
  const declineQuote = useQuoteStore((s) => s.declineQuote)
  const contacts = useContactStore((s) => s.contacts)
  const contact = contacts.find((c) => c.id === quote.contact_id)

  const [working, setWorking] = useState<string | null>(null)
  const [chargeResult, setChargeResult] = useState<{ status: string; message: string } | null>(null)
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => { usersApi.list().then((r) => setUsers(r.items)).catch(() => {}) }, [])

  const createdByUser = quote.created_by ? users.find((u) => u.id === quote.created_by) : null

  async function handleSend() {
    setWorking('send')
    try { await sendQuote(quote.id) } finally { setWorking(null) }
  }

  async function handleResend() {
    setWorking('resend')
    try { await sendQuote(quote.id) } finally { setWorking(null) }
  }

  async function handleAccept() {
    setWorking('accept')
    try { await acceptQuote(quote.id) } finally { setWorking(null) }
  }

  async function handleDecline() {
    setWorking('decline')
    try { await declineQuote(quote.id) } finally { setWorking(null) }
  }

  async function handleCharge() {
    if (quote.equipment_total <= 0) return
    setWorking('charge')
    setChargeResult(null)
    try {
      const result = await authnetApi.charge({
        contact_id: quote.contact_id,
        amount: quote.equipment_total,
        description: `Equipment & install - ${quote.title}`,
      })
      if (result.status === 'succeeded') {
        setChargeResult({ status: 'success', message: `Charged ${currencyFormat.format(result.amount)}. Invoice sent to ${contact?.email || 'customer'}.` })
      } else {
        setChargeResult({ status: 'error', message: result.failure_message || 'Charge declined' })
      }
    } catch (e) {
      setChargeResult({ status: 'error', message: e instanceof Error ? e.message : 'Charge failed' })
    } finally {
      setWorking(null)
    }
  }

  async function handleDownloadPdf() {
    const blob = await quotesApi.getPdf(quote.id)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-heading">{quote.title}</h3>
        <div className="mt-2 flex items-center gap-2">
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[quote.status]}`}>
            {QUOTE_STATUS_LABELS[quote.status]}
          </span>
          {contact && (
            <span className="text-sm text-muted-foreground">
              {contact.first_name} {contact.last_name}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons — contextual based on status */}
      <div className="flex flex-wrap gap-2">
        {quote.status === 'draft' && (
          <button
            onClick={handleSend}
            disabled={working !== null}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {working === 'send' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send to Customer
          </button>
        )}
        {quote.status === 'sent' && (
          <>
            <button
              onClick={handleAccept}
              disabled={working !== null}
              className="inline-flex items-center gap-1.5 rounded-md bg-success/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-success disabled:opacity-50"
            >
              {working === 'accept' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Mark Accepted
            </button>
            <button
              onClick={handleDecline}
              disabled={working !== null}
              className="inline-flex items-center gap-1.5 rounded-md bg-danger/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-danger disabled:opacity-50"
            >
              {working === 'decline' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              Decline
            </button>
            <button
              onClick={handleResend}
              disabled={working !== null}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-heading hover:bg-page disabled:opacity-50"
            >
              {working === 'resend' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Resend
            </button>
          </>
        )}
        {quote.status === 'accepted' && quote.equipment_total > 0 && (
          <button
            onClick={handleCharge}
            disabled={working !== null}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {working === 'charge' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DollarSign className="h-3.5 w-3.5" />}
            Charge {currencyFormat.format(quote.equipment_total)}
          </button>
        )}
        <button
          onClick={handleDownloadPdf}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-heading hover:bg-page"
        >
          <FileText className="h-3.5 w-3.5" />
          PDF
        </button>
      </div>

      {/* Billing Actions (accepted quotes) */}
      {quote.status === 'accepted' && (
        <BillingActions
          contactId={quote.contact_id}
          equipmentOwed={quote.equipment_total}
          monitoringAmount={quote.monthly_monitoring_amount}
          hasActiveSubscription={false}
          compact={false}
        />
      )}

      {/* Charge result */}
      {chargeResult && (
        <div className={`rounded-md border px-3 py-2 text-xs ${
          chargeResult.status === 'success' ? 'border-success/20 bg-success/5 text-success' : 'border-danger/20 bg-danger/5 text-danger'
        }`}>
          {chargeResult.message}
        </div>
      )}

      {/* Equipment line items */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-page/50 px-4 py-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Equipment & Installation</h4>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {quote.equipment_lines.map((line) => (
              <tr key={line.id} className="border-t border-border">
                <td className="px-4 py-2 text-heading">{line.product_name}</td>
                <td className="px-4 py-2 text-muted-foreground text-center w-12">{line.quantity}x</td>
                <td className="px-4 py-2 text-body text-right w-20">{currencyFormat.format(line.unit_price)}</td>
                <td className="px-4 py-2 font-medium text-heading text-right w-20">{currencyFormat.format(line.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-page/30">
              <td colSpan={3} className="px-4 py-2 font-semibold text-heading text-right">Equipment Total</td>
              <td className="px-4 py-2 font-bold text-heading text-right">{currencyFormat.format(quote.equipment_total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Monitoring */}
      {quote.monthly_monitoring_amount > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-page/50 border border-border px-4 py-2.5">
          <span className="text-xs text-muted-foreground">Monthly Monitoring</span>
          <span className="text-sm font-bold text-heading">{currencyFormat.format(quote.monthly_monitoring_amount)}/mo</span>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border bg-page/50 p-4">
        <Field label="Created" value={format(new Date(quote.created_at), 'MMM d, yyyy')} />
        <Field label="Created By" value={createdByUser ? `${createdByUser.first_name} ${createdByUser.last_name}` : 'System'} />
        {quote.sent_at && <Field label="Sent" value={format(new Date(quote.sent_at), 'MMM d, yyyy')} />}
        {quote.accepted_at && <Field label="Accepted" value={format(new Date(quote.accepted_at), 'MMM d, yyyy')} />}
      </div>

      {/* Notes */}
      {quote.notes && (
        <div>
          <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</h4>
          <p className="text-xs leading-relaxed text-body">{quote.notes}</p>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xs font-medium text-heading">{value}</dd>
    </div>
  )
}
