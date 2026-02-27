import { useState } from 'react'
import { CreditCard, CheckCircle2, AlertTriangle, RefreshCw, Mail, Clock, Shield } from 'lucide-react'

interface RetryConfig {
  retry_1_days: number
  retry_2_days: number
  retry_3_days: number
  max_attempts: number
}

export default function PaymentSettings() {
  const [isConnected] = useState(true)
  const [environment] = useState<'sandbox' | 'production'>('sandbox')
  const [retryConfig, setRetryConfig] = useState<RetryConfig>({
    retry_1_days: 3,
    retry_2_days: 7,
    retry_3_days: 14,
    max_attempts: 3,
  })
  const [autoInvoice, setAutoInvoice] = useState(true)
  const [sendFailureEmails, setSendFailureEmails] = useState(true)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

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
                {isConnected ? 'Connected' : 'Not connected'}
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
              </>
            ) : (
              <button className="rounded-lg bg-[#635BFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#635BFF]/90">
                Connect Stripe
              </button>
            )}
          </div>
        </div>

        {isConnected && (
          <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-page/50 p-4">
            <div>
              <dt className="text-xs text-muted-foreground">Account ID</dt>
              <dd className="mt-0.5 text-sm font-medium text-heading font-mono">acct_test_shield_security</dd>
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
              <dt className="text-xs text-muted-foreground">Webhook Status</dt>
              <dd className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-success">
                <CheckCircle2 className="h-3 w-3" />
                Active
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
          When a payment fails, the system will automatically retry according to this schedule.
          After all retries are exhausted, the subscription is marked past due and the owner is notified.
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-warning/10 text-[10px] font-bold text-warning">1</span>
            <label className="text-sm text-body">First retry after</label>
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
            <label className="text-sm text-body">Second retry after</label>
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
            <label className="text-sm text-body">Final retry after</label>
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
        <div className="space-y-2">
          {[
            { event: 'payment_intent.succeeded', status: 'processed', time: '2 min ago', id: 'evt_1234' },
            { event: 'invoice.payment_succeeded', status: 'processed', time: '2 min ago', id: 'evt_1235' },
            { event: 'customer.subscription.updated', status: 'processed', time: '1 hour ago', id: 'evt_1236' },
            { event: 'payment_intent.payment_failed', status: 'processed', time: '3 days ago', id: 'evt_1237' },
            { event: 'charge.refunded', status: 'ignored', time: '5 days ago', id: 'evt_1238' },
          ].map((evt) => (
            <div key={evt.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-heading font-mono">{evt.event}</p>
                  <p className="text-[10px] text-muted-foreground">{evt.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  evt.status === 'processed'
                    ? 'bg-success/10 text-success'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {evt.status}
                </span>
                <span className="text-[10px] text-muted-foreground">{evt.time}</span>
              </div>
            </div>
          ))}
        </div>
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
