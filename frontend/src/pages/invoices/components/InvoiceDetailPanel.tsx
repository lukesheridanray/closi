import { format, differenceInDays } from 'date-fns'
import { Send, CheckCircle2, XCircle, Download, AlertTriangle } from 'lucide-react'
import type { Invoice } from '@/types/invoice'
import { INVOICE_TYPE_LABELS, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from '@/types/invoice'
import useInvoiceStore from '@/stores/invoiceStore'
import useContactStore from '@/stores/contactStore'
import { usePaymentsForContract } from '@/stores/contractStore'
import { PAYMENT_STATUS_LABELS } from '@/types/contract'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

interface InvoiceDetailPanelProps {
  invoice: Invoice
}

export default function InvoiceDetailPanel({ invoice }: InvoiceDetailPanelProps) {
  const sendInvoice = useInvoiceStore((s) => s.sendInvoice)
  const markPaid = useInvoiceStore((s) => s.markPaid)
  const voidInvoice = useInvoiceStore((s) => s.voidInvoice)
  const contacts = useContactStore((s) => s.contacts)

  const contractPayments = usePaymentsForContract(invoice.contract_id)

  const contact = contacts.find((c) => c.id === invoice.contact_id)
  const isOverdue = invoice.status === 'overdue'
  const daysOverdue = isOverdue ? differenceInDays(new Date(), new Date(invoice.due_date)) : 0

  // Match payments to this invoice by date proximity and amount
  const invoicePayments = contractPayments.filter((p) => {
    if (invoice.type === 'one_time' && p.type === 'equipment') return true
    if (invoice.type === 'recurring' && p.type === 'monitoring') {
      const paymentDate = new Date(p.paid_at)
      const dueDate = new Date(invoice.due_date)
      const diff = Math.abs(differenceInDays(paymentDate, dueDate))
      return diff <= 35
    }
    return false
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold text-heading">{invoice.invoice_number}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{INVOICE_TYPE_LABELS[invoice.type]}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INVOICE_STATUS_COLORS[invoice.status]}`}>
          {INVOICE_STATUS_LABELS[invoice.status]}
        </span>
      </div>

      {/* Overdue warning */}
      {isOverdue && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3">
          <AlertTriangle className="h-4 w-4 text-danger" />
          <span className="text-sm font-medium text-danger">{daysOverdue} days overdue</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {invoice.status === 'draft' && (
          <button
            onClick={() => sendInvoice(invoice.id)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
          >
            <Send className="h-3.5 w-3.5" />
            Send Invoice
          </button>
        )}
        {(invoice.status === 'sent' || invoice.status === 'overdue') && (
          <button
            onClick={() => markPaid(invoice.id)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-success/90"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Mark as Paid
          </button>
        )}
        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
          <button
            onClick={() => voidInvoice(invoice.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/5"
          >
            <XCircle className="h-3.5 w-3.5" />
            Void
          </button>
        )}
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-body transition-colors hover:bg-page">
          <Download className="h-3.5 w-3.5" />
          Download PDF
        </button>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border p-4">
        <div>
          <dt className="text-xs text-muted-foreground">Customer</dt>
          <dd className="mt-0.5 text-sm font-medium text-heading">
            {contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Due Date</dt>
          <dd className={`mt-0.5 text-sm font-medium ${isOverdue ? 'text-danger' : 'text-heading'}`}>
            {format(new Date(invoice.due_date), 'MMM d, yyyy')}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Created</dt>
          <dd className="mt-0.5 text-sm text-body">
            {format(new Date(invoice.created_at), 'MMM d, yyyy')}
          </dd>
        </div>
        {invoice.sent_at && (
          <div>
            <dt className="text-xs text-muted-foreground">Sent</dt>
            <dd className="mt-0.5 text-sm text-body">
              {format(new Date(invoice.sent_at), 'MMM d, yyyy')}
            </dd>
          </div>
        )}
        {invoice.paid_at && (
          <div>
            <dt className="text-xs text-muted-foreground">Paid</dt>
            <dd className="mt-0.5 text-sm font-medium text-success">
              {format(new Date(invoice.paid_at), 'MMM d, yyyy')}
            </dd>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Line Items
        </h4>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-page/50">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unit Price</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((line, i) => (
                <tr key={i} className="border-b border-border/50 last:border-b-0">
                  <td className="px-3 py-2 text-sm text-heading">{line.description}</td>
                  <td className="px-3 py-2 text-right text-sm text-body">{line.quantity}</td>
                  <td className="px-3 py-2 text-right text-sm text-body">{currencyFormat.format(line.unit_price)}</td>
                  <td className="px-3 py-2 text-right text-sm font-medium text-heading">{currencyFormat.format(line.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="space-y-2 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Subtotal</span>
          <span className="text-sm text-body">{currencyFormat.format(invoice.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Tax ({(invoice.tax_rate * 100).toFixed(2)}%)</span>
          <span className="text-sm text-body">{currencyFormat.format(invoice.tax_amount)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-sm font-bold text-heading">Total</span>
          <span className="text-lg font-bold text-primary">{currencyFormat.format(invoice.total)}</span>
        </div>
      </div>

      {/* Payment History */}
      {invoicePayments.length > 0 && (
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Payments Applied
          </h4>
          <div className="space-y-2">
            {invoicePayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                <div>
                  <p className="text-xs font-medium text-heading">
                    {payment.type === 'equipment' ? 'Equipment Charge' : 'Monthly Monitoring'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(payment.paid_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-heading">{currencyFormat.format(payment.amount)}</p>
                  <p className={`text-[10px] font-medium ${
                    payment.status === 'succeeded' ? 'text-success' :
                    payment.status === 'failed' ? 'text-danger' : 'text-muted-foreground'
                  }`}>
                    {PAYMENT_STATUS_LABELS[payment.status]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {invoice.notes && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Notes
          </h4>
          <p className="text-sm text-body">{invoice.notes}</p>
        </div>
      )}
    </div>
  )
}
