import { format } from 'date-fns'
import { Send, CheckCircle2, FileText } from 'lucide-react'
import type { Quote } from '@/types/quote'
import { QUOTE_STATUS_LABELS } from '@/types/quote'
import useQuoteStore from '@/stores/quoteStore'
import useContractStore from '@/stores/contractStore'
import useContactStore from '@/stores/contactStore'

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
  const createContractFromQuote = useContractStore((s) => s.createContractFromQuote)
  const contacts = useContactStore((s) => s.contacts)

  const contact = contacts.find((c) => c.id === quote.contact_id)

  function handleAcceptAndCreateContract() {
    acceptQuote(quote.id)
    createContractFromQuote({
      deal_id: quote.deal_id,
      contact_id: quote.contact_id,
      quote_id: quote.id,
      title: quote.title,
      equipment_total: quote.equipment_total,
      monthly_amount: quote.monitoring.monthly_amount,
      term_months: quote.monitoring.term_months,
      auto_renewal: quote.monitoring.auto_renewal,
      equipment_list: quote.equipment_lines.map((l) => ({ name: l.product_name, quantity: l.quantity })),
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-heading">{quote.title}</h3>
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

      {/* Action buttons */}
      {quote.status === 'draft' && (
        <button
          onClick={() => sendQuote(quote.id)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-info px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-info/90"
        >
          <Send className="h-4 w-4" />
          Send Quote
        </button>
      )}
      {quote.status === 'sent' && (
        <button
          onClick={handleAcceptAndCreateContract}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-success/90"
        >
          <CheckCircle2 className="h-4 w-4" />
          Accept & Create Contract
        </button>
      )}

      {/* Equipment line items */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-page/50 px-4 py-2.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Equipment & Installation</h4>
        </div>
        <table className="w-full">
          <tbody>
            {quote.equipment_lines.map((line) => (
              <tr key={line.id} className="border-t border-border">
                <td className="px-4 py-2 text-sm text-heading">{line.product_name}</td>
                <td className="px-4 py-2 text-sm text-muted-foreground text-center w-16">{line.quantity}x</td>
                <td className="px-4 py-2 text-sm text-body text-right w-24">{currencyFormat.format(line.unit_price)}</td>
                <td className="px-4 py-2 text-sm font-medium text-heading text-right w-24">{currencyFormat.format(line.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-page/30">
              <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-heading text-right">Equipment Total</td>
              <td className="px-4 py-2 text-sm font-bold text-heading text-right">{currencyFormat.format(quote.equipment_total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Monitoring plan */}
      <div className="rounded-lg border border-border bg-page/50 p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monitoring Plan</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <dt className="text-xs text-muted-foreground">Monthly</dt>
            <dd className="mt-0.5 text-sm font-bold text-primary">{currencyFormat.format(quote.monitoring.monthly_amount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Term</dt>
            <dd className="mt-0.5 text-sm font-medium text-heading">{quote.monitoring.term_months} months</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Auto-Renew</dt>
            <dd className="mt-0.5 text-sm font-medium text-heading">{quote.monitoring.auto_renewal ? 'Yes' : 'No'}</dd>
          </div>
        </div>
      </div>

      {/* Total contract value */}
      <div className="rounded-lg bg-primary/5 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-heading">Total Contract Value</span>
          <span className="text-xl font-bold text-primary">{currencyFormat.format(quote.total_contract_value)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {currencyFormat.format(quote.equipment_total)} equipment + {currencyFormat.format(quote.monitoring.monthly_amount)}/mo x {quote.monitoring.term_months} months
        </p>
      </div>

      {/* Dates */}
      <div className="rounded-lg border border-border bg-page/50 p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Created" value={format(new Date(quote.created_at), 'MMM d, yyyy')} />
          <Field label="Created By" value={quote.created_by} />
          {quote.sent_at && <Field label="Sent" value={format(new Date(quote.sent_at), 'MMM d, yyyy')} />}
          {quote.accepted_at && <Field label="Accepted" value={format(new Date(quote.accepted_at), 'MMM d, yyyy')} />}
          {quote.valid_until && <Field label="Valid Until" value={format(new Date(quote.valid_until), 'MMM d, yyyy')} />}
        </div>
      </div>

      {/* Notes */}
      {quote.notes && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</h4>
          <p className="text-sm leading-relaxed text-body">{quote.notes}</p>
        </div>
      )}

      {/* PDF stub */}
      <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-body transition-colors hover:bg-page">
        <FileText className="h-4 w-4" />
        Download PDF
      </button>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-heading">{value}</dd>
    </div>
  )
}
