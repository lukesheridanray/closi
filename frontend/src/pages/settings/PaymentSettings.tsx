import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CreditCard, CheckCircle2, AlertTriangle, RefreshCw,
  Mail, Clock, Shield, ExternalLink, Loader2, XCircle, Unplug
} from 'lucide-react'
import { stripeApi } from '@/lib/api'
import type { StripeStatus, WebhookLog } from '@/lib/api'

interface RetryConfig {
  retry_1_days: number
  retry_2_days: number
  retry_3_days: number
  max_attempts: number
}

export default function PaymentSettings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null)
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [retryConfig, setRetryConfig] = useState<RetryConfig>({
    retry_1_days: 3,
    retry_2_days: 7,
    retry_3_days: 14,
    max_attempts: 3,
  })
  const [autoInvoice, setAutoInvoice] = useState(true)
  const [sendFailureEmails, setSendFailureEmails] = useState(true)
  const [saved, setSaved] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      const [status, logs] = await Promise.all([
        stripeApi.getStatus(),
        stripeApi.getWebhookLogs().catch(() => []),
      ])
      setStripeStatus(status)
      setWebhookLogs(logs)
    } catch {
      setStripeStatus({
        connected: false,
        account_id: null,
        onboarding_complete: false,
        charges_enabled: false,
        business_name: null,
        environment: null,
        error: null,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  // Handle Stripe Connect callback
  useEffect(() => {
    const stripeParam = searchParams.get('stripe')
    if (stripeParam === 'complete') {
      stripeApi.callback().then(() => {
        loadStatus()
        setSearchParams({}, { replace: true })
      })
    } else if (stripeParam === 'refresh') {
      // User needs to re-do onboarding
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, loadStatus, setSearchParams])

  async function handleConnect() {
    setConnecting(true)
    try {
      const { url } = await stripeApi.connect()
      window.location.href = url
    } catch {
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect Stripe? This will not cancel existing subscriptions in Stripe, but LSRV CRM will no longer receive payment updates.')) {
      return
    }
    setDisconnecting(true)
    try {
      await stripeApi.disconnect()
      await loadStatus()
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleDashboard() {
    try {
      const { url } = await stripeApi.getDashboardLink()
      window.open(url, '_blank')
    } catch {
      // silently fail
    }
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function timeAgo(isoStr: string): string {
    const diff = Date.now() - new Date(isoStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} min ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    const days = Math.floor(hours / 24)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const isConnected = stripeStatus?.connected ?? false
  const environment = stripeStatus?.environment ?? 'sandbox'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-heading">Payment Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure payment processor and billing settings</p>
      </div>

      {/* Stripe Connection */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-card">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-heading">
          <CreditCard className="h-4 w-4 text-primary" />
          Payment Processor
        </h2>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#635BFF]/10">
              <span className="text-lg font-bold text-[#635BFF]">S</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-heading">Stripe</p>
              <p className="text-xs text-muted-foreground">
                {isConnected
                  ? `Connected${stripeStatus?.business_name ? ` - ${stripeStatus.business_name}` : ''}`
                  : stripeStatus?.account_id && !stripeStatus?.onboarding_complete
                    ? 'Onboarding incomplete'
                    : 'Not connected'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  environment === 'production'
                    ? 'bg-success/10 text-success'
                    : 'bg-warning/10 text-warning'
                }`}>
                  {environment === 'production' ? 'Live' : 'Test Mode'}
                </span>
                <button
                  onClick={handleDashboard}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-body hover:bg-page/50"
                >
                  <ExternalLink className="mr-1 inline h-3 w-3" />
                  Dashboard
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/5"
                >
                  {disconnecting ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : <Unplug className="mr-1 inline h-3 w-3" />}
                  Disconnect
                </button>
              </>
            ) : stripeStatus?.account_id && !stripeStatus?.onboarding_complete ? (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="rounded-lg bg-[#635BFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#635BFF]/90 disabled:opacity-50"
              >
                {connecting ? <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" /> : null}
                Complete Setup
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="rounded-lg bg-[#635BFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#635BFF]/90 disabled:opacity-50"
              >
                {connecting ? <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" /> : null}
                Connect Stripe
              </button>
            )}
          </div>
        </div>

        {isConnected && stripeStatus && (
          <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-page/50 p-4">
            <div>
              <dt className="text-xs text-muted-foreground">Account ID</dt>
              <dd className="mt-0.5 text-sm font-medium text-heading font-mono">{stripeStatus.account_id}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Environment</dt>
              <dd className="mt-0.5 text-sm font-medium text-heading">{environment === 'production' ? 'Production' : 'Sandbox (Test)'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Webhook URL</dt>
              <dd className="mt-0.5 text-xs font-mono text-body break-all">/api/v1/webhooks/stripe</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Charges Enabled</dt>
              <dd className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-success">
                {stripeStatus.charges_enabled ? (
                  <><CheckCircle2 className="h-3 w-3" /> Yes</>
                ) : (
                  <><XCircle className="h-3 w-3 text-danger" /> No</>
                )}
              </dd>
            </div>
          </div>
        )}
      </div>

      {/* Retry Configuration */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-card">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-heading">
          <RefreshCw className="h-4 w-4 text-primary" />
          Failed Payment Retry Schedule
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          When a payment fails, Stripe Smart Retries will automatically attempt to collect.
          LSRV CRM will create tasks and send notifications based on this schedule.
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-warning/10 text-[10px] font-bold text-warning">1</span>
            <label className="text-sm text-body">First notification after</label>
            <input
              type="number"
              value={retryConfig.retry_1_days}
              onChange={(e) => setRetryConfig({ ...retryConfig, retry_1_days: Number(e.target.value) })}
              min={1}
              max={30}
              className="w-16 rounded-lg border-b-2 border-border bg-transparent px-2 py-1.5 text-center text-sm text-heading focus:border-primary focus:outline-none"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-warning/10 text-[10px] font-bold text-warning">2</span>
            <label className="text-sm text-body">Second notification after</label>
            <input
              type="number"
              value={retryConfig.retry_2_days}
              onChange={(e) => setRetryConfig({ ...retryConfig, retry_2_days: Number(e.target.value) })}
              min={1}
              max={30}
              className="w-16 rounded-lg border-b-2 border-border bg-transparent px-2 py-1.5 text-center text-sm text-heading focus:border-primary focus:outline-none"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-danger/10 text-[10px] font-bold text-danger">3</span>
            <label className="text-sm text-body">Final notification after</label>
            <input
              type="number"
              value={retryConfig.retry_3_days}
              onChange={(e) => setRetryConfig({ ...retryConfig, retry_3_days: Number(e.target.value) })}
              min={1}
              max={30}
              className="w-16 rounded-lg border-b-2 border-border bg-transparent px-2 py-1.5 text-center text-sm text-heading focus:border-primary focus:outline-none"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-page/50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-warning" />
            <p className="text-xs text-muted-foreground">
              After {retryConfig.max_attempts} failed attempts, the subscription will be marked as <strong>past due</strong>.
              The account owner will receive a notification and the contract will appear in the Revenue at Risk section.
            </p>
          </div>
        </div>
      </div>

      {/* Email Notifications */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-card">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-heading">
          <Mail className="h-4 w-4 text-primary" />
          Email Notifications
        </h2>

        <div className="space-y-4">
          <label className="flex items-center justify-between rounded-lg border border-border p-4 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-heading">Auto-send invoices</p>
              <p className="text-xs text-muted-foreground">Automatically email invoices to customers when charges are processed</p>
            </div>
            <input
              type="checkbox"
              checked={autoInvoice}
              onChange={(e) => setAutoInvoice(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>

          <label className="flex items-center justify-between rounded-lg border border-border p-4 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-heading">Payment failure emails</p>
              <p className="text-xs text-muted-foreground">Send customers an email with a payment update link after each failed payment attempt</p>
            </div>
            <input
              type="checkbox"
              checked={sendFailureEmails}
              onChange={(e) => setSendFailureEmails(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>
        </div>
      </div>

      {/* Webhook Events Log */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-card">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-heading">
          <Clock className="h-4 w-4 text-primary" />
          Recent Webhook Events
        </h2>
        {webhookLogs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {isConnected ? 'No webhook events received yet' : 'Connect Stripe to see webhook events'}
          </p>
        ) : (
          <div className="space-y-2">
            {webhookLogs.map((evt) => (
              <div key={evt.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium text-heading font-mono">{evt.event_type}</p>
                    <p className="text-[10px] text-muted-foreground">{evt.external_event_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    evt.processing_status === 'processed'
                      ? 'bg-success/10 text-success'
                      : evt.processing_status === 'error'
                        ? 'bg-danger/10 text-danger'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {evt.processing_status}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(evt.received_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
