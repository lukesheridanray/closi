import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { differenceInDays, format, isPast, isToday } from 'date-fns'
import { Mail, Phone, MapPin, CheckCircle2, AlertTriangle, Plus, FileText, DollarSign, Send } from 'lucide-react'
import type { DealWithContact, PipelineStage } from '@/types/pipeline'
import { useEntityLabels } from '@/hooks/useEntityLabels'
import { TASK_TYPE_LABELS, TASK_PRIORITY_LABELS } from '@/types/task'
import { QUOTE_STATUS_LABELS } from '@/types/quote'
import { useTasksForDeal } from '@/stores/taskStore'
import useTaskStore from '@/stores/taskStore'
import useQuoteStore from '@/stores/quoteStore'
import useContactStore from '@/stores/contactStore'
import { usersApi, authnetApi, paymentsApi } from '@/lib/api'
import type { User } from '@/lib/api'
import BillingActions from '@/components/shared/BillingActions'
import CreateTaskModal from '@/pages/tasks/components/CreateTaskModal'
import QuoteBuilder from '@/pages/quotes/components/QuoteBuilder'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const priorityColors: Record<string, string> = {
  urgent: 'text-danger',
  high: 'text-warning',
  medium: 'text-info',
  low: 'text-muted-foreground',
}

interface DealDetailPanelProps {
  deal: DealWithContact
  stage: PipelineStage
}

const quoteStatusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-info/10 text-info',
  accepted: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
  expired: 'bg-warning/10 text-warning',
}

export default function DealDetailPanel({ deal, stage }: DealDetailPanelProps) {
  const navigate = useNavigate()
  const { deal: dealLabel } = useEntityLabels()
  const { contact } = deal
  const daysInStage = differenceInDays(new Date(), new Date(deal.updated_at))
  const dealTasks = useTasksForDeal(deal.id)
  const completeTask = useTaskStore((s) => s.completeTask)
  const selectContact = useContactStore((s) => s.selectContact)
  const allQuotes = useQuoteStore((s) => s.quotes)
  const fetchQuotes = useQuoteStore((s) => s.fetchQuotes)
  const sendQuote = useQuoteStore((s) => s.sendQuote)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false)
  const [showCharge, setShowCharge] = useState(false)
  const [chargeAmount, setChargeAmount] = useState(deal.estimated_value > 0 ? String(deal.estimated_value) : '')
  const [chargeDesc, setChargeDesc] = useState('Equipment / install payment')
  const [charging, setCharging] = useState(false)
  const [chargeResult, setChargeResult] = useState<{ status: string; amount: number; message?: string } | null>(null)
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => { fetchQuotes() }, [fetchQuotes])
  useEffect(() => { usersApi.list().then((r) => setUsers(r.items)).catch(() => {}) }, [])

  const dealQuotes = allQuotes.filter((q) => q.deal_id === deal.id)
  const acceptedQuotes = dealQuotes.filter((q) => q.status === 'accepted')
  const acceptedEquipmentOwed = acceptedQuotes.reduce((sum, q) => sum + q.equipment_total, 0)
  const acceptedMonitoringAmount = acceptedQuotes.length > 0 ? acceptedQuotes[0].monthly_monitoring_amount : 0
  const assignedUser = deal.assigned_to ? users.find((u) => u.id === deal.assigned_to) : null

  return (
    <div className="space-y-6">
      {/* Contact + value header */}
      <div>
        <h3 className="text-xl font-bold text-heading">
          {contact.first_name} {contact.last_name}
        </h3>
        {contact.company && (
          <p className="mt-0.5 text-sm text-muted-foreground">{contact.company}</p>
        )}
        <p className="mt-2 text-2xl font-bold text-primary">
          {currencyFormat.format(deal.estimated_value)}
        </p>
      </div>

      {/* Stage badge */}
      <div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white"
          style={{ backgroundColor: stage.color }}
        >
          {stage.name}
        </span>
      </div>

      {/* Deal info grid */}
      <div className="rounded-lg border border-border bg-page/50 p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {dealLabel.singular} Details
        </h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field
            label="Expected Close"
            value={deal.expected_close_date ? format(new Date(deal.expected_close_date), 'MMM d, yyyy') : 'Not set'}
          />
          <Field label="Assigned To" value={assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name}` : 'Unassigned'} />
          <Field label="Days in Stage" value={`${daysInStage} days`} />
          <Field label="Created" value={format(new Date(deal.created_at), 'MMM d, yyyy')} />
        </div>
      </div>

      {/* Contact info */}
      <div className="rounded-lg border border-border bg-page/50 p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Contact Info
        </h4>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm text-body">
            <Mail className="h-4 w-4 text-muted-foreground" />
            {contact.email}
          </div>
          <div className="flex items-center gap-2 text-sm text-body">
            <Phone className="h-4 w-4 text-muted-foreground" />
            {contact.phone}
          </div>
          {contact.address && (
            <div className="flex items-start gap-2 text-sm text-body">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span>
                {contact.address}
                {contact.city && `, ${contact.city}`}
                {contact.state && `, ${contact.state}`}
                {contact.zip && ` ${contact.zip}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tasks section */}
      <div className="rounded-lg border border-border bg-page/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tasks
          </h4>
          <button
            onClick={() => setShowCreateTask(true)}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
        {dealTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks</p>
        ) : (
          <div className="space-y-2">
            {dealTasks.map((task) => {
              const dueDate = new Date(task.due_date)
              const isOverdue = task.status !== 'completed' && task.status !== 'cancelled' && isPast(dueDate) && !isToday(dueDate)
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-white p-2.5"
                >
                  {(task.status === 'pending' || task.status === 'in_progress') && (
                    <button
                      onClick={() => completeTask(task.id)}
                      className="flex-shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-success"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  )}
                  {task.status === 'completed' && (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${task.status === 'completed' ? 'text-muted-foreground line-through' : 'text-heading'}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{TASK_TYPE_LABELS[task.type]}</span>
                      <span className={`text-[10px] ${priorityColors[task.priority]}`}>{TASK_PRIORITY_LABELS[task.priority]}</span>
                      {isOverdue && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-danger">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Overdue
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] flex-shrink-0 ${isOverdue ? 'text-danger' : 'text-muted-foreground'}`}>
                    {dueDate ? format(dueDate, 'MMM d') : 'No due date'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Notes */}
      {deal.notes && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Notes
          </h4>
          <p className="text-sm leading-relaxed text-body">{deal.notes}</p>
        </div>
      )}

      {/* Quotes */}
      <div className="rounded-lg border border-border bg-page/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Quotes
          </h4>
          <button
            onClick={() => setShowQuoteBuilder(true)}
            className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-hover"
          >
            <Plus className="h-3 w-3" /> New
          </button>
        </div>
        {dealQuotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quotes yet</p>
        ) : (
          <div className="space-y-2">
            {dealQuotes.map((quote) => (
              <div key={quote.id} className="rounded-lg border border-border bg-white p-2.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-heading truncate">{quote.title}</p>
                    <span className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${quoteStatusColors[quote.status] ?? quoteStatusColors.draft}`}>
                      {QUOTE_STATUS_LABELS[quote.status]}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-primary">${quote.equipment_total.toFixed(2)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {quote.status === 'draft' && (
                    <button
                      onClick={async () => { await sendQuote(quote.id) }}
                      className="rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-white hover:bg-primary-hover"
                    >
                      Send
                    </button>
                  )}
                  {quote.status === 'sent' && (
                    <button
                      onClick={async () => { await sendQuote(quote.id) }}
                      className="rounded border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-heading"
                    >
                      Resend
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Billing Actions (accepted quotes) */}
      {acceptedQuotes.length > 0 && (
        <BillingActions
          contactId={deal.contact_id}
          equipmentOwed={acceptedEquipmentOwed}
          monitoringAmount={acceptedMonitoringAmount}
          hasActiveSubscription={false}
          compact={true}
        />
      )}

      {/* Billing */}
      <div className="rounded-lg border border-border bg-page/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Billing
          </h4>
          {!showCharge && (
            <button
              onClick={() => setShowCharge(true)}
              className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-hover"
            >
              <DollarSign className="h-3 w-3" /> Charge
            </button>
          )}
        </div>

        {showCharge && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={chargeDesc}
                onChange={(e) => setChargeDesc(e.target.value)}
                placeholder="Description"
                className="flex-1 min-w-0 rounded border border-border bg-white px-2 py-1 text-xs text-heading outline-none focus:border-primary"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                placeholder="$0.00"
                className="w-20 rounded border border-border bg-white px-2 py-1 text-xs text-heading outline-none focus:border-primary"
              />
              <button
                onClick={async () => {
                  const amt = parseFloat(chargeAmount)
                  if (!amt || amt <= 0) return
                  setCharging(true)
                  setChargeResult(null)
                  try {
                    const result = await authnetApi.charge({
                      contact_id: deal.contact_id,
                      amount: amt,
                      description: chargeDesc || 'Payment',
                    })
                    setChargeResult({ status: result.status, amount: result.amount, message: result.failure_message || undefined })
                    if (result.status === 'succeeded') setChargeAmount('')
                  } catch (e) {
                    setChargeResult({ status: 'error', amount: amt, message: e instanceof Error ? e.message : 'Charge failed' })
                  } finally {
                    setCharging(false)
                  }
                }}
                disabled={charging || !chargeAmount || parseFloat(chargeAmount) <= 0}
                className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {charging ? '...' : 'Charge'}
              </button>
              <button onClick={() => { setShowCharge(false); setChargeResult(null) }} className="text-[10px] text-muted-foreground hover:text-heading">
                Cancel
              </button>
            </div>
            {chargeResult && (
              <div className={`rounded border px-2.5 py-1.5 text-xs ${
                chargeResult.status === 'succeeded' ? 'border-success/20 bg-success/5 text-success' : 'border-danger/20 bg-danger/5 text-danger'
              }`}>
                {chargeResult.status === 'succeeded' ? 'Approved' : 'Failed'}: ${chargeResult.amount.toFixed(2)}
                {chargeResult.message && ` - ${chargeResult.message}`}
              </div>
            )}
          </div>
        )}

        {!showCharge && !chargeResult && (
          <p className="text-xs text-muted-foreground">Charge the customer's card on file</p>
        )}
      </div>

      {/* Quick actions */}
      <div className="rounded-lg border border-border bg-page/50 p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Actions
        </h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { selectContact(deal.contact_id); navigate('/contacts') }}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-heading hover:bg-white"
          >
            Open Account
          </button>
          <button
            onClick={() => setShowQuoteBuilder(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-heading hover:bg-white"
          >
            <FileText className="h-3 w-3" /> Create Quote
          </button>
        </div>
      </div>

      {/* Create task modal */}
      {showCreateTask && (
        <CreateTaskModal
          onClose={() => setShowCreateTask(false)}
          prefillContactId={deal.contact_id}
          prefillDealId={deal.id}
        />
      )}

      {/* Quote builder */}
      {showQuoteBuilder && (
        <QuoteBuilder
          onClose={() => { setShowQuoteBuilder(false); fetchQuotes() }}
          defaultContactId={deal.contact_id}
          defaultDealId={deal.id}
        />
      )}
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
