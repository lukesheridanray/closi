import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, CreditCard, DollarSign, ExternalLink, Loader2, RadioTower, RefreshCw, ShieldCheck } from 'lucide-react'
import { authnetApi, contractsApi, paymentsApi, subscriptionsApi } from '@/lib/api'
import { openHostedProfilePage } from '@/lib/authnetHostedPage'
import type { AuthnetStatus, PaymentProfile } from '@/lib/api'
import type { Contact } from '@/types/contact'
import type { Payment } from '@/types/contract'
import type { Subscription } from '@/types/contract'

const pendingHostedKey = 'lsrv_pending_hosted_profile_contact'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

interface BillingConsoleProps {
  contact: Contact
  onRefreshBilling: () => void | Promise<void>
  acceptedQuoteTotal?: number
}

type NoticeTone = 'info' | 'success' | 'error'

interface NoticeState {
  tone: NoticeTone
  message: string
}

interface ChargeResultSummary {
  status: 'succeeded' | 'failed'
  amount: number
  description: string
  paymentId: string
  paymentDate: string | null
  failureMessage: string | null
}

export default function BillingConsole({ contact, onRefreshBilling, acceptedQuoteTotal }: BillingConsoleProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [authnetStatus, setAuthnetStatus] = useState<AuthnetStatus | null>(null)
  const [profile, setProfile] = useState<PaymentProfile | null>(null)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [notice, setNotice] = useState<NoticeState | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  const [lastChargeResult, setLastChargeResult] = useState<ChargeResultSummary | null>(null)

  const [expanded, setExpanded] = useState(false)
  const [showChargeForm, setShowChargeForm] = useState(false)
  const [chargeAmount, setChargeAmount] = useState('')
  const [chargeDescription, setChargeDescription] = useState('Equipment / install payment')

  const [planTitle, setPlanTitle] = useState(`${contact.last_name} Monitoring`)
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [equipmentTotal, setEquipmentTotal] = useState('')
  const [termMonths, setTermMonths] = useState('36')

  async function loadBillingState() {
    setLoading(true)
    try {
      const [statusResult, profileResult, subscriptionsResult] = await Promise.all([
        authnetApi.getStatus().catch(() => null),
        authnetApi.getCustomerProfile(contact.id).catch(() => null),
        subscriptionsApi.list({ contact_id: contact.id, page_size: 25 }).catch(() => ({ items: [] })),
      ])

      setAuthnetStatus(statusResult)
      setProfile(profileResult)
      setSubscriptions(subscriptionsResult.items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBillingState()
  }, [contact.id])

  useEffect(() => {
    async function syncAfterHostedReturn() {
      const pendingContactId = window.sessionStorage.getItem(pendingHostedKey)
      if (pendingContactId !== contact.id || working === 'sync_profile') return

      try {
        setWorking('sync_profile')
        const synced = await authnetApi.syncCustomerProfile(contact.id)
        setProfile(synced)
        window.sessionStorage.removeItem(pendingHostedKey)
        setNotice({
          tone: synced.external_payment_id ? 'success' : 'info',
          message: synced.external_payment_id
            ? 'Card saved on Authorize.net. LSRV CRM refreshed the account automatically.'
            : 'Returned from Authorize.net, but no saved payment method was found yet.',
        })
        await Promise.resolve(onRefreshBilling())
      } catch {
        // Leave the key in place so the manual refresh button still has context.
      } finally {
        setWorking(null)
      }
    }

    function handleFocus() {
      void syncAfterHostedReturn()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [contact.id, onRefreshBilling, working])

  const authnetConfigured = authnetStatus?.connected ?? false
  const activeSubscription = useMemo(
    () => subscriptions.find((subscription) => subscription.status === 'active' || subscription.status === 'past_due') ?? null,
    [subscriptions],
  )
  const hasBillingProfile = Boolean(profile?.external_customer_id)
  const hasPaymentMethod = Boolean(profile?.external_payment_id)
  const isACH = profile?.payment_method_type === 'bank_account'
  const chargeReady = authnetConfigured && hasBillingProfile && hasPaymentMethod
  const paymentMethodLabel = isACH
    ? `ACH •••• ${profile?.payment_method_last4 ?? '----'}`
    : `${profile?.payment_method_brand ?? 'Card'} •••• ${profile?.payment_method_last4 ?? '----'}`
  const billingChecklist = [
    { label: 'Processor connected', done: authnetConfigured },
    { label: 'Billing profile created', done: hasBillingProfile },
    { label: 'Payment method on file', done: hasPaymentMethod },
    { label: 'Monitoring active', done: Boolean(activeSubscription) },
  ]
  const completedSteps = billingChecklist.filter((item) => item.done).length
  const setupComplete = completedSteps >= 3  // processor + profile + payment method
  const chargeAmountValue = Number(chargeAmount)
  const hasValidChargeAmount = Number.isFinite(chargeAmountValue) && chargeAmountValue > 0
  const chargeButtonLabel = hasValidChargeAmount
    ? `Charge ${currencyFormat.format(chargeAmountValue)}`
    : 'Charge Customer'

  async function ensureCustomerProfile() {
    if (profile?.external_customer_id) return profile
    const created = await authnetApi.createCustomer(contact.id)
    setProfile(created)
    return created
  }

  async function handleCreateCustomer() {
    setWorking('customer')
    setNotice(null)
    try {
      const created = await authnetApi.createCustomer(contact.id)
      setProfile(created)
      setNotice({
        tone: 'success',
        message: 'Billing profile created. The next step is adding the payment method securely on Authorize.net.',
      })
    } catch (err) {
      setNotice({ tone: 'error', message: extractError(err, 'Unable to create billing profile.') })
    } finally {
      setWorking(null)
    }
  }

  async function handleManagePaymentMethod() {
    setWorking('hosted_profile')
    setNotice(null)
    try {
      await ensureCustomerProfile()
      const session = await authnetApi.createHostedProfilePage({
        contact_id: contact.id,
        action: hasPaymentMethod ? 'manage' : 'add_payment',
        return_url: `${window.location.origin}/contacts`,
      })
      window.sessionStorage.setItem(pendingHostedKey, contact.id)
      openHostedProfilePage(session)
      setNotice({
        tone: 'info',
        message: 'Authorize.net opened in a new tab. When you come back here, LSRV CRM will try to refresh the saved card automatically.',
      })
    } catch (err) {
      setNotice({ tone: 'error', message: extractError(err, 'Unable to open the secure payment method form.') })
    } finally {
      setWorking(null)
    }
  }

  async function handleSyncCardStatus() {
    setWorking('sync_profile')
    setNotice(null)
    try {
      const synced = await authnetApi.syncCustomerProfile(contact.id)
      setProfile(synced)
      setNotice({
        tone: synced.external_payment_id ? 'success' : 'info',
        message: synced.external_payment_id
          ? 'Card status refreshed from Authorize.net.'
          : 'No saved card was found on the Authorize.net profile yet.',
      })
      await Promise.resolve(onRefreshBilling())
    } catch (err) {
      setNotice({ tone: 'error', message: extractError(err, 'Unable to refresh card status from Authorize.net.') })
    } finally {
      setWorking(null)
    }
  }

  async function handleCharge() {
    setWorking('charge')
    setNotice(null)
    setLastChargeResult(null)
    try {
      await ensureCustomerProfile()
      if (!hasValidChargeAmount) {
        setNotice({ tone: 'error', message: 'Enter a valid upfront charge amount greater than $0.00.' })
        return
      }

      const charge = await authnetApi.charge({
        contact_id: contact.id,
        amount: chargeAmountValue,
        description: chargeDescription || 'Equipment / install payment',
      })
      const paymentRecord = await paymentsApi.get(charge.payment_id).catch(() => null as Payment | null)
      const chargeResult: ChargeResultSummary = {
        status: charge.status === 'succeeded' ? 'succeeded' : 'failed',
        amount: charge.amount,
        description: chargeDescription || 'Equipment / install payment',
        paymentId: charge.payment_id,
        paymentDate: paymentRecord?.payment_date ?? paymentRecord?.created_at ?? null,
        failureMessage: charge.failure_message ?? paymentRecord?.failure_message ?? null,
      }
      setLastChargeResult(chargeResult)
      await Promise.resolve(onRefreshBilling())

      if (charge.status !== 'succeeded') {
        setNotice({
          tone: 'error',
          message: chargeResult.failureMessage || 'Authorize.net declined the upfront charge.',
        })
        return
      }

      setChargeAmount('')
      setNotice({
        tone: 'success',
        message: `${currencyFormat.format(charge.amount)} was approved and the payment history has been refreshed.`,
      })
    } catch (err) {
      setNotice({ tone: 'error', message: extractError(err, 'Unable to run one-time charge.') })
    } finally {
      setWorking(null)
    }
  }

  async function handleStartMonitoring() {
    setWorking('subscription')
    setNotice(null)
    try {
      const ensuredProfile = await ensureCustomerProfile()
      if (!ensuredProfile.external_payment_id) {
        throw new Error('Add a card in Authorize.net before starting monitoring.')
      }

      const monthly = Number(monthlyAmount)
      const equipment = Number(equipmentTotal || '0')
      const term = Number(termMonths || '36')

      const contract = await contractsApi.create({
        contact_id: contact.id,
        title: planTitle,
        monthly_amount: monthly,
        equipment_total: equipment,
        term_months: term,
        total_value: equipment + (monthly * term),
        start_date: new Date().toISOString(),
        notes: 'Monitoring plan created from customer billing console.',
      })

      await authnetApi.createSubscription(contract.id)
      await loadBillingState()
      await Promise.resolve(onRefreshBilling())
      setNotice({
        tone: 'success',
        message: `${currencyFormat.format(monthly)} per month monitoring is now active on this account.`,
      })
    } catch (err) {
      setNotice({ tone: 'error', message: extractError(err, 'Unable to start monitoring subscription.') })
    } finally {
      setWorking(null)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-white p-5 shadow-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading billing tools...
        </div>
      </div>
    )
  }

  // Compact mode: setup is done, show single summary line
  if (setupComplete && !expanded) {
    return (
      <div className="rounded-xl border border-border bg-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" />
          <span className="text-xs font-medium text-heading">{paymentMethodLabel}</span>
          <span className="text-[10px] text-muted-foreground">|</span>
          {activeSubscription && (
            <>
              <span className="text-xs font-medium text-success">{currencyFormat.format(activeSubscription.amount)}/mo</span>
              <span className="text-[10px] text-muted-foreground">|</span>
            </>
          )}
          {!showChargeForm ? (
            <button
              onClick={() => {
                if (acceptedQuoteTotal && acceptedQuoteTotal > 0 && !chargeAmount) {
                  setChargeAmount(String(Math.round(acceptedQuoteTotal * 100) / 100))
                }
                setShowChargeForm(true)
              }}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20"
            >
              <DollarSign className="h-3 w-3" />
              Charge
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={chargeDescription}
                onChange={(e) => setChargeDescription(e.target.value)}
                placeholder="Description"
                className="w-32 rounded border border-border px-2 py-0.5 text-[11px] text-heading outline-none focus:border-primary"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                placeholder="$0.00"
                className="w-16 rounded border border-border px-2 py-0.5 text-[11px] text-heading outline-none focus:border-primary"
              />
              <button
                onClick={handleCharge}
                disabled={working !== null || !hasValidChargeAmount}
                className="inline-flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {working === 'charge' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {working === 'charge' ? '...' : hasValidChargeAmount ? currencyFormat.format(chargeAmountValue) : 'Go'}
              </button>
              <button
                onClick={() => setShowChargeForm(false)}
                className="text-[11px] text-muted-foreground hover:text-heading"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="ml-auto">
            <button
              onClick={() => setExpanded(true)}
              className="text-[11px] text-muted-foreground hover:text-heading"
            >
              Manage
            </button>
          </div>
        </div>

        {notice && (
          <div className="border-t border-border px-4 py-2">
            <StatusNotice tone={notice.tone}>{notice.message}</StatusNotice>
          </div>
        )}

        {lastChargeResult && (
          <div className={`border-t px-4 py-2 text-xs ${
            lastChargeResult.status === 'succeeded' ? 'bg-success/5 text-success' : 'bg-danger/5 text-danger'
          }`}>
            {lastChargeResult.status === 'succeeded' ? 'Approved' : 'Failed'}: {currencyFormat.format(lastChargeResult.amount)}
            {lastChargeResult.failureMessage && ` - ${lastChargeResult.failureMessage}`}
          </div>
        )}
      </div>
    )
  }

  // Expanded / setup mode
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Billing Console
        </h3>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            setupComplete ? 'bg-success/10 text-success' : 'bg-page text-heading'
          }`}>
            {completedSteps}/4
          </span>
          {setupComplete && (
            <button
              onClick={() => setExpanded(false)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-heading"
            >
              Collapse
              <ChevronUp className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {!authnetConfigured && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-warning/20 bg-warning/5 px-3 py-2">
          <span className="text-xs text-warning">Connect Authorize.net to enable billing</span>
          <button
            onClick={() => navigate('/settings/payments')}
            className="flex items-center gap-1 text-xs font-medium text-warning hover:underline"
          >
            Payment Settings <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {notice && (
        <StatusNotice tone={notice.tone} className="mt-3">
          {notice.message}
        </StatusNotice>
      )}

      <div className="mt-4 space-y-3">
        {/* Step 1: Payment Method */}
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">1</span>
              <span className="text-xs font-semibold text-heading">Payment Method</span>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">
              {hasPaymentMethod ? paymentMethodLabel : hasBillingProfile ? 'Needs payment method' : 'Not started'}
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {!hasBillingProfile && (
              <button
                onClick={handleCreateCustomer}
                disabled={working !== null || !authnetConfigured}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-heading hover:bg-page disabled:opacity-50"
              >
                {working === 'customer' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                Create Profile
              </button>
            )}
            <button
              onClick={handleManagePaymentMethod}
              disabled={working !== null || !authnetConfigured}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {working === 'hosted_profile' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
              {hasPaymentMethod ? 'Update Method' : 'Add Method'}
            </button>
            {hasBillingProfile && (
              <button
                onClick={handleSyncCardStatus}
                disabled={working !== null || !authnetConfigured}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-heading hover:bg-page disabled:opacity-50"
              >
                {working === 'sync_profile' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Sync
              </button>
            )}
          </div>
        </div>

        {/* Step 2: Upfront Charge */}
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">2</span>
              <span className="text-xs font-semibold text-heading">Upfront Charge</span>
            </div>
            <span className={`text-[10px] font-medium ${chargeReady ? 'text-success' : 'text-muted-foreground'}`}>
              {chargeReady ? 'Ready' : 'Waiting on step 1'}
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <input
              type="text"
              value={chargeDescription}
              onChange={(e) => setChargeDescription(e.target.value)}
              placeholder="Description"
              className="min-w-0 flex-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-heading outline-none focus:border-primary"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={chargeAmount}
              onChange={(e) => setChargeAmount(e.target.value)}
              placeholder="$0.00"
              className="w-20 rounded-md border border-border px-2.5 py-1.5 text-xs text-heading outline-none focus:border-primary"
            />
            <button
              onClick={handleCharge}
              disabled={working !== null || !hasValidChargeAmount || !chargeReady}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {working === 'charge' ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />}
              {working === 'charge' ? 'Charging...' : hasValidChargeAmount ? currencyFormat.format(chargeAmountValue) : 'Charge'}
            </button>
          </div>
          {lastChargeResult && (
            <div className={`mt-2 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
              lastChargeResult.status === 'succeeded'
                ? 'border-success/20 bg-success/5 text-success'
                : 'border-danger/20 bg-danger/5 text-danger'
            }`}>
              {lastChargeResult.status === 'succeeded' ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              <span className="font-medium">{lastChargeResult.status === 'succeeded' ? 'Approved' : 'Failed'}</span>
              <span>{currencyFormat.format(lastChargeResult.amount)}</span>
              {lastChargeResult.failureMessage && <span className="truncate">{lastChargeResult.failureMessage}</span>}
            </div>
          )}
        </div>

        {/* Step 3: Monitoring */}
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">3</span>
              <span className="text-xs font-semibold text-heading">Monitoring</span>
            </div>
            <span className={`text-[10px] font-medium ${activeSubscription ? 'text-success' : 'text-muted-foreground'}`}>
              {activeSubscription ? `${currencyFormat.format(activeSubscription.amount)}/mo` : 'Not started'}
            </span>
          </div>
          {!activeSubscription && (
            <div className="mt-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  placeholder="Plan title"
                  className="min-w-0 flex-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-heading outline-none focus:border-primary"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthlyAmount}
                  onChange={(e) => setMonthlyAmount(e.target.value)}
                  placeholder="$/mo"
                  className="w-20 rounded-md border border-border px-2.5 py-1.5 text-xs text-heading outline-none focus:border-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={equipmentTotal}
                  onChange={(e) => setEquipmentTotal(e.target.value)}
                  placeholder="Equipment $"
                  className="min-w-0 flex-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-heading outline-none focus:border-primary"
                />
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                  placeholder="Months"
                  className="w-20 rounded-md border border-border px-2.5 py-1.5 text-xs text-heading outline-none focus:border-primary"
                />
                <button
                  onClick={handleStartMonitoring}
                  disabled={working !== null || !monthlyAmount || !chargeReady}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {working === 'subscription' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RadioTower className="h-3 w-3" />}
                  Start
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface BillingStepProps {
  number: number
  title: string
  description: string
  status: string
  children: React.ReactNode
}

function BillingStep({ number, title, description, status, children }: BillingStepProps) {
  return (
    <section className="rounded-xl border border-border bg-page/30 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {number}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-heading">{title}</h4>
            <span className="text-right text-xs font-medium text-muted-foreground">{status}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function StatusNotice({ tone, className = '', children }: { tone: NoticeTone; className?: string; children: React.ReactNode }) {
  const styles = {
    info: 'border-info/20 bg-info/5 text-info',
    success: 'border-success/20 bg-success/5 text-success',
    error: 'border-danger/20 bg-danger/5 text-danger',
  }

  return (
    <div className={`${className} rounded-lg border px-3 py-2 text-sm ${styles[tone]}`}>
      {children}
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
