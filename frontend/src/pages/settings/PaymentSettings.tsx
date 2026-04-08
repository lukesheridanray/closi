import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Shield,
  Unplug,
  Webhook,
} from 'lucide-react'
import { authnetApi, stripeApi } from '@/lib/api'
import type { AuthnetStatus, StripeStatus, WebhookLog } from '@/lib/api'

interface AuthnetFormState {
  api_login_id: string
  transaction_key: string
  signature_key: string
  environment: 'sandbox' | 'production'
}

const initialFormState: AuthnetFormState = {
  api_login_id: '',
  transaction_key: '',
  signature_key: '',
  environment: 'sandbox',
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

export default function PaymentSettings() {
  const [authnetStatus, setAuthnetStatus] = useState<AuthnetStatus | null>(null)
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null)
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<AuthnetFormState>(initialFormState)

  const loadBillingStatus = useCallback(async () => {
    try {
      const [authnet, stripe, logs] = await Promise.all([
        authnetApi.getStatus().catch(() => null),
        stripeApi.getStatus().catch(() => null),
        authnetApi.getWebhookLogs().catch(() => []),
      ])
      setAuthnetStatus(authnet)
      setStripeStatus(stripe)
      setWebhookLogs(logs)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBillingStatus()
  }, [loadBillingStatus])

  async function handleConnect() {
    setConnecting(true)
    setError(null)
    setSaved(false)
    try {
      await authnetApi.connect(form)
      await loadBillingStatus()
      setSaved(true)
      setForm(initialFormState)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
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
        setError(String((err.response as { data: { detail: unknown } }).data.detail))
      } else {
        setError('Unable to connect Authorize.net right now.')
      }
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    setError(null)
    try {
      await authnetApi.disconnect()
      await loadBillingStatus()
    } catch {
      setError('Unable to disconnect Authorize.net right now.')
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const authnetConnected = authnetStatus?.connected ?? false
  const stripeConnected = stripeStatus?.connected ?? false

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-heading">Payment Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          LSRV CRM should own the billing workflow for upfront charges, monitoring subscriptions, and failed payment follow-up.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-white p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-heading">
              <CreditCard className="h-4 w-4 text-primary" />
              Primary Processor: Authorize.net
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              This is the billing path Medley already uses in FillQuick. Connect it first so LSRV CRM can store CIM profiles, run one-time equipment charges, and create ARB monitoring subscriptions.
            </p>
          </div>
          {authnetConnected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
              <AlertTriangle className="h-3 w-3" />
              Needs Setup
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-border bg-page/40 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Billing Workflow
            </h3>
            <div className="mt-4 space-y-3">
              {[
                'Save a CIM customer profile when the sale is ready for payment.',
                'Store a default payment method for the account.',
                'Run the one-time equipment or install charge.',
                'Create the recurring monitoring subscription from the same account.',
                'Track successes, failures, retries, and payment history inside LSRV CRM.',
              ].map((step, index) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {index + 1}
                  </div>
                  <p className="text-sm text-body">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Connection Status
            </h3>
            <div className="mt-4 space-y-3">
              <StatusRow label="Processor" value="Authorize.net" />
              <StatusRow label="Environment" value={authnetStatus?.environment ?? 'Not connected'} />
              <StatusRow label="Auto-Invoice" value={authnetStatus?.auto_invoice ? 'Enabled' : 'Off'} />
              <StatusRow label="Retry Window" value={authnetStatus?.retry_failed_days ? `${authnetStatus.retry_failed_days} days` : 'Default'} />
            </div>
            {authnetConnected && (
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-danger/30 px-3 py-2 text-xs font-medium text-danger transition-colors hover:bg-danger/5 disabled:opacity-50"
              >
                {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                Disconnect
              </button>
            )}
          </div>
        </div>

        {!authnetConnected && (
          <div className="mt-5 rounded-xl border border-border bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Connect Credentials
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">API Login ID</span>
                <input
                  type="text"
                  value={form.api_login_id}
                  onChange={(e) => setForm({ ...form, api_login_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-heading outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Transaction Key</span>
                <input
                  type="password"
                  value={form.transaction_key}
                  onChange={(e) => setForm({ ...form, transaction_key: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-heading outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Signature Key</span>
                <input
                  type="password"
                  value={form.signature_key}
                  onChange={(e) => setForm({ ...form, signature_key: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-heading outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Environment</span>
                <select
                  value={form.environment}
                  onChange={(e) => setForm({ ...form, environment: e.target.value as 'sandbox' | 'production' })}
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-heading outline-none focus:border-primary"
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </label>
            </div>

            {error && (
              <div className="mt-4 rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}

            {saved && (
              <div className="mt-4 rounded-lg bg-success/5 px-3 py-2 text-sm text-success">
                Authorize.net connected successfully.
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleConnect}
                disabled={connecting || !form.api_login_id || !form.transaction_key}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                Connect Authorize.net
              </button>
              <p className="text-xs text-muted-foreground">
                Credentials are stored per organization so billing can stay tenant-safe.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-white p-6 shadow-card">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-heading">
          <Webhook className="h-4 w-4 text-primary" />
          Billing Event Log
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          These logs are how we confirm recurring billing events, retries, and failures are actually flowing back into LSRV CRM.
        </p>

        {webhookLogs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No Authorize.net webhook events received yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {webhookLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-heading">{log.event_type}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(log.received_at)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  log.processing_status === 'processed'
                    ? 'bg-success/10 text-success'
                    : log.processing_status === 'failed'
                      ? 'bg-danger/10 text-danger'
                      : 'bg-warning/10 text-warning'
                }`}>
                  {log.processing_status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-white p-6 shadow-card">
        <h2 className="text-sm font-semibold text-heading">Secondary Processor</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Stripe can stay available for future customers, but it should not be the primary path for Medley while Authorize.net remains the live billing system.
        </p>
        <div className="mt-4 flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-heading">Stripe</p>
            <p className="text-xs text-muted-foreground">
              {stripeConnected ? 'Connected as an alternate processor' : 'Not connected'}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            stripeConnected ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
          }`}>
            {stripeConnected ? 'Available' : 'Inactive'}
          </span>
        </div>
      </div>
    </div>
  )
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-heading">{value}</span>
    </div>
  )
}
