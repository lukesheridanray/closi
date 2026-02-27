import { useEffect } from 'react'
import { format, differenceInDays } from 'date-fns'
import { Shield, Package } from 'lucide-react'
import type { Contract } from '@/types/contract'
import { CONTRACT_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/types/contract'
import useContactStore from '@/stores/contactStore'
import useContractStore, { usePaymentsForContract } from '@/stores/contractStore'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success',
  pending: 'bg-warning/10 text-warning',
  expired: 'bg-muted text-muted-foreground',
  cancelled: 'bg-danger/10 text-danger',
  past_due: 'bg-danger/10 text-danger',
}

const paymentStatusColors: Record<string, string> = {
  succeeded: 'text-success',
  failed: 'text-danger',
  refunded: 'text-warning',
  pending: 'text-muted-foreground',
}

interface ContractDetailPanelProps {
  contract: Contract
}

export default function ContractDetailPanel({ contract }: ContractDetailPanelProps) {
  const contacts = useContactStore((s) => s.contacts)
  const fetchPayments = useContractStore((s) => s.fetchPayments)
  const payments = usePaymentsForContract(contract.id)

  // Fetch payments when contract detail panel opens
  useEffect(() => { fetchPayments({ contract_id: contract.id }) }, [contract.id, fetchPayments])

  const contact = contacts.find((c) => c.id === contract.contact_id)
  const daysUntilEnd = contract.end_date ? differenceInDays(new Date(contract.end_date), new Date()) : 0
  const totalPaid = payments
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0)
  const monthsAsCustomer = contract.start_date ? Math.max(1, Math.round(differenceInDays(new Date(), new Date(contract.start_date)) / 30)) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-heading">{contract.title}</h3>
        <div className="mt-2 flex items-center gap-2">
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[contract.status]}`}>
            {CONTRACT_STATUS_LABELS[contract.status]}
          </span>
          {contact && (
            <span className="text-sm text-muted-foreground">{contact.first_name} {contact.last_name}</span>
          )}
        </div>
      </div>

      {/* Monthly amount hero */}
      <div className="rounded-lg bg-primary/5 p-4 text-center">
        <p className="text-xs font-medium text-muted-foreground">Monthly Monitoring</p>
        <p className="mt-1 text-3xl font-bold text-primary">{currencyFormat.format(contract.monthly_amount)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{contract.term_months} month contract</p>
      </div>

      {/* Contract details */}
      <div className="rounded-lg border border-border bg-page/50 p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Contract Details
        </h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Start Date" value={contract.start_date ? format(new Date(contract.start_date), 'MMM d, yyyy') : 'N/A'} />
          <Field label="End Date" value={contract.end_date ? format(new Date(contract.end_date), 'MMM d, yyyy') : 'N/A'} />
          <Field
            label="Days Until Renewal"
            value={daysUntilEnd > 0 ? `${daysUntilEnd} days` : 'Expired'}
          />
          <Field label="Total Value" value={currencyFormat.format(contract.total_value)} />
          <Field label="Equipment Total" value={currencyFormat.format(contract.equipment_total)} />
          <Field label="Tenure" value={`${monthsAsCustomer} months`} />
          <Field label="Total Paid" value={currencyFormat.format(totalPaid)} />
          {contract.signed_at && (
            <Field label="Signed" value={format(new Date(contract.signed_at), 'MMM d, yyyy')} />
          )}
        </div>
      </div>

      {/* Equipment installed */}
      <div className="rounded-lg border border-border bg-page/50 p-4">
        <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Package className="h-3.5 w-3.5" />
          Equipment Installed
        </h4>
        {!contract.equipment_lines || contract.equipment_lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No equipment recorded</p>
        ) : (
          <div className="space-y-1.5">
            {contract.equipment_lines.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-body">{item.name}</span>
                <span className="text-muted-foreground">x{item.quantity}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment history */}
      <div className="rounded-lg border border-border bg-page/50 p-4">
        <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Shield className="h-3.5 w-3.5" />
          Payment History
        </h4>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded</p>
        ) : (
          <div className="space-y-2">
            {payments
              .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
              .map((payment) => (
                <div key={payment.id} className="flex items-center justify-between rounded-lg border border-border bg-white p-2.5">
                  <div>
                    <p className="text-xs font-medium text-heading">
                      Payment
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(payment.payment_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-heading">{currencyFormat.format(payment.amount)}</p>
                    <p className={`text-[10px] font-medium ${paymentStatusColors[payment.status]}`}>
                      {PAYMENT_STATUS_LABELS[payment.status]}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
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
