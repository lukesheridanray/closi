import { useEffect, useState } from 'react'
import { format, differenceInDays } from 'date-fns'
import { Shield, Package, CreditCard, Radio } from 'lucide-react'
import type { Contract } from '@/types/contract'
import { CONTRACT_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/types/contract'
import useContactStore from '@/stores/contactStore'
import useContractStore, { usePaymentsForContract } from '@/stores/contractStore'
import { authnetApi } from '@/lib/api'
import BillingActions from '@/components/shared/BillingActions'

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

  const [chargeResult, setChargeResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null)
  const [subResult, setSubResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null)
  const [chargingEquipment, setChargingEquipment] = useState(false)
  const [startingMonitoring, setStartingMonitoring] = useState(false)

  // Fetch payments when contract detail panel opens
  useEffect(() => { fetchPayments({ contract_id: contract.id }) }, [contract.id, fetchPayments])

  const contact = contacts.find((c) => c.id === contract.contact_id)
  const daysUntilEnd = contract.end_date ? differenceInDays(new Date(contract.end_date), new Date()) : 0
  // Payments linked to this contract
  const contractPaid = payments
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0)
  // For billing actions, use contract-level payments
  const totalPaid = contractPaid
  const monthsAsCustomer = contract.start_date ? Math.max(1, Math.round(differenceInDays(new Date(), new Date(contract.start_date)) / 30)) : 0

  const hasEquipmentTotal = contract.equipment_total > 0
  const hasMonthlyNoSub = contract.monthly_amount > 0 && !contract.subscription_id

  async function handleChargeEquipment() {
    setChargingEquipment(true)
    setChargeResult(null)
    try {
      const res = await authnetApi.charge({
        contact_id: contract.contact_id,
        amount: contract.equipment_total,
        description: `Equipment charge for ${contract.title}`,
        contract_id: contract.id,
      })
      if (res.status === 'succeeded' || res.status === 'approved') {
        setChargeResult({ status: 'success', message: `Charged ${currencyFormat.format(res.amount)} successfully` })
        fetchPayments({ contract_id: contract.id })
      } else {
        setChargeResult({ status: 'error', message: res.failure_message || `Charge ${res.status}` })
      }
    } catch (err: any) {
      setChargeResult({ status: 'error', message: err?.response?.data?.detail || err?.message || 'Charge failed' })
    } finally {
      setChargingEquipment(false)
    }
  }

  async function handleStartMonitoring() {
    setStartingMonitoring(true)
    setSubResult(null)
    try {
      const res = await authnetApi.createSubscription(contract.id)
      if (res.status === 'active' || res.status === 'created') {
        setSubResult({ status: 'success', message: `Subscription started — ${currencyFormat.format(res.amount)}/mo` })
      } else {
        setSubResult({ status: 'error', message: `Subscription status: ${res.status}` })
      }
    } catch (err: any) {
      setSubResult({ status: 'error', message: err?.response?.data?.detail || err?.message || 'Failed to create subscription' })
    } finally {
      setStartingMonitoring(false)
    }
  }

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

      {/* Billing Actions — only show for actionable items */}
      {/* Install-only agreement: show charge if equipment unpaid */}
      {/* Monitoring agreement: show setup if no subscription yet */}
      {(contract.equipment_total > 0 && totalPaid < contract.equipment_total && !contract.subscription_id) ||
       (contract.monthly_amount > 0 && !contract.subscription_id) ? (
        <BillingActions
          contactId={contract.contact_id}
          equipmentOwed={contract.monthly_amount === 0 ? Math.max(0, contract.equipment_total - totalPaid) : 0}
          monitoringAmount={contract.monthly_amount}
          hasActiveSubscription={!!contract.subscription_id}
          onChargeComplete={() => fetchPayments({ contract_id: contract.id })}
          compact={false}
        />
      ) : null}

      {/* Monthly amount hero */}
      {contract.monthly_amount > 0 && (
        <div className="rounded-lg bg-primary/5 p-4 text-center">
          <p className="text-xs font-medium text-muted-foreground">Monthly Monitoring</p>
          <p className="mt-1 text-3xl font-bold text-primary">{currencyFormat.format(contract.monthly_amount)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {contract.term_months <= 1 ? 'Month-to-month' : `${contract.term_months} month agreement`}
            {contract.subscription_id ? ' — Active' : ''}
          </p>
        </div>
      )}

      {/* Agreement details */}
      <div className="rounded-lg border border-border bg-page/50 p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Agreement Details
        </h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Start Date" value={contract.start_date ? format(new Date(contract.start_date), 'MMM d, yyyy') : 'N/A'} />
          <Field label="End Date" value={contract.end_date ? format(new Date(contract.end_date), 'MMM d, yyyy') : contract.term_months <= 1 ? 'Month-to-month' : 'N/A'} />
          {contract.term_months > 1 && (
            <Field
              label="Days Until Renewal"
              value={contract.end_date ? (daysUntilEnd > 0 ? `${daysUntilEnd} days` : 'Due for renewal') : 'N/A'}
            />
          )}
          {contract.equipment_total > 0 && (
            <Field label="Equipment Total" value={currencyFormat.format(contract.equipment_total)} />
          )}
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
