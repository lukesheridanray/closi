import { useState } from 'react'
import { AlertTriangle, CheckCircle2, DollarSign, Loader2, RadioTower } from 'lucide-react'
import { authnetApi } from '@/lib/api'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

interface BillingActionsProps {
  contactId: string
  /** Total equipment/install amount from accepted quotes */
  equipmentOwed: number
  /** Monthly monitoring amount from accepted quotes */
  monitoringAmount: number
  /** Whether monitoring subscription is already active */
  hasActiveSubscription: boolean
  /** Called after a successful charge to refresh parent data */
  onChargeComplete?: () => void
  /** Compact single-line mode for tight spaces */
  compact?: boolean
}

export default function BillingActions({
  contactId,
  equipmentOwed,
  monitoringAmount,
  hasActiveSubscription,
  onChargeComplete,
  compact = false,
}: BillingActionsProps) {
  const [working, setWorking] = useState<string | null>(null)
  const [result, setResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null)

  const hasEquipment = equipmentOwed > 0
  const hasMonitoring = monitoringAmount > 0 && !hasActiveSubscription

  if (!hasEquipment && !hasMonitoring) return null

  async function handleCharge() {
    setWorking('charge')
    setResult(null)
    try {
      const res = await authnetApi.charge({
        contact_id: contactId,
        amount: Math.round(equipmentOwed * 100) / 100,
        description: 'Equipment & installation charge',
      })
      if (res.status === 'succeeded') {
        setResult({ status: 'success', message: `Charged ${currencyFormat.format(res.amount)}. Invoice sent.` })
        onChargeComplete?.()
      } else {
        setResult({ status: 'error', message: res.failure_message || 'Charge declined' })
      }
    } catch (e) {
      setResult({ status: 'error', message: e instanceof Error ? e.message : 'Charge failed' })
    } finally {
      setWorking(null)
    }
  }

  if (compact) {
    return (
      <div className="space-y-1.5">
        {hasEquipment && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-warning font-medium">Owed: {currencyFormat.format(equipmentOwed)}</span>
            <button
              onClick={handleCharge}
              disabled={working !== null}
              className="rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {working === 'charge' ? 'Charging...' : `Charge ${currencyFormat.format(equipmentOwed)}`}
            </button>
          </div>
        )}
        {hasMonitoring && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{currencyFormat.format(monitoringAmount)}/mo not started</span>
          </div>
        )}
        {result && (
          <div className={`rounded px-2 py-1 text-[10px] ${
            result.status === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}>
            {result.message}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-3">
      <h4 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
        <AlertTriangle className="h-3 w-3" />
        Billing Actions Needed
      </h4>

      {result && (
        <div className={`mt-2 rounded-md border px-2.5 py-1.5 text-xs ${
          result.status === 'success' ? 'border-success/20 bg-success/5 text-success' : 'border-danger/20 bg-danger/5 text-danger'
        }`}>
          {result.status === 'success' ? <CheckCircle2 className="inline h-3 w-3 mr-1" /> : <AlertTriangle className="inline h-3 w-3 mr-1" />}
          {result.message}
        </div>
      )}

      <div className="mt-2 space-y-1.5">
        {hasEquipment && (
          <div className="flex items-center justify-between rounded-lg bg-white border border-border px-3 py-2">
            <div>
              <p className="text-xs font-medium text-heading">Equipment & install: {currencyFormat.format(equipmentOwed)}</p>
              <p className="text-[10px] text-muted-foreground">Card on file will be charged</p>
            </div>
            <button
              onClick={handleCharge}
              disabled={working !== null}
              className="rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {working === 'charge' ? <Loader2 className="inline h-3 w-3 animate-spin mr-1" /> : <DollarSign className="inline h-3 w-3 mr-0.5" />}
              {working === 'charge' ? 'Charging...' : `Charge ${currencyFormat.format(equipmentOwed)}`}
            </button>
          </div>
        )}
        {hasMonitoring && (
          <div className="flex items-center justify-between rounded-lg bg-white border border-border px-3 py-2">
            <div>
              <p className="text-xs font-medium text-heading">Monthly monitoring: {currencyFormat.format(monitoringAmount)}/mo</p>
              <p className="text-[10px] text-muted-foreground">Subscription not yet active</p>
            </div>
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
              <RadioTower className="inline h-3 w-3 mr-0.5" />
              Setup needed
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
