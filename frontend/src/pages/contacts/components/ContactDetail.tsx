import { useEffect, useState } from 'react'
import { format, isPast, isToday } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail, Phone, MapPin, Edit, CheckCircle2, AlertTriangle, CreditCard, Plus, FileText } from 'lucide-react'
import type { Contact } from '@/types/contact'
import {
  LEAD_SOURCE_LABELS,
  CONTACT_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
} from '@/types/contact'
import { TASK_TYPE_LABELS, TASK_PRIORITY_LABELS } from '@/types/task'
import type { TaskType } from '@/types/task'
import { QUOTE_STATUS_LABELS } from '@/types/quote'
import useContactStore from '@/stores/contactStore'
import usePipelineStore from '@/stores/pipelineStore'
import useQuoteStore from '@/stores/quoteStore'
import { useEntityLabels } from '@/hooks/useEntityLabels'
import useTaskStore, { useTasksForContact } from '@/stores/taskStore'
import useContractStore, { useContractsForContact, usePaymentsForContact } from '@/stores/contractStore'
import { useInvoicesForContact } from '@/stores/invoiceStore'
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from '@/types/invoice'
import { usersApi, quotesApi, authnetApi } from '@/lib/api'
import type { User } from '@/lib/api'
import ActivityTimeline from './ActivityTimeline'
import QuickActions from './QuickActions'
import BillingConsole from './BillingConsole'
import QuoteBuilder from '@/pages/quotes/components/QuoteBuilder'
import { useSchedulingPrompt, SchedulingModal } from '@/hooks/useSchedulingPrompt'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const quoteStatusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-info/10 text-info',
  accepted: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
  expired: 'bg-warning/10 text-warning',
}

const statusColors: Record<string, string> = {
  new: 'bg-info/10 text-info',
  active: 'bg-success/10 text-success',
  customer: 'bg-primary/10 text-primary',
  inactive: 'bg-muted text-muted-foreground',
  lost: 'bg-danger/10 text-danger',
}

interface ContactDetailProps {
  contact: Contact
  onBack: () => void
}

export default function ContactDetail({ contact, onBack }: ContactDetailProps) {
  const navigate = useNavigate()
  const { deal: dealLabel } = useEntityLabels()
  const updateContact = useContactStore((s) => s.updateContact)
  const activities = useContactStore((s) => s.activities)
  const fetchActivities = useContactStore((s) => s.fetchActivities)
  const deals = usePipelineStore((s) => s.deals)
  const stages = usePipelineStore((s) => s.stages)
  const fetchPipelines = usePipelineStore((s) => s.fetchPipelines)
  const fetchDeals = usePipelineStore((s) => s.fetchDeals)
  const activePipelineId = usePipelineStore((s) => s.activePipelineId)
  const moveDealRaw = usePipelineStore((s) => s.moveDeal)
  const scheduling = useSchedulingPrompt()
  const contactTasks = useTasksForContact(contact.id)
  const completeTask = useTaskStore((s) => s.completeTask)
  const addTask = useTaskStore((s) => s.addTask)
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const allQuotes = useQuoteStore((s) => s.quotes)
  const fetchQuotes = useQuoteStore((s) => s.fetchQuotes)
  const sendQuote = useQuoteStore((s) => s.sendQuote)
  const acceptQuote = useQuoteStore((s) => s.acceptQuote)
  const declineQuote = useQuoteStore((s) => s.declineQuote)
  const deleteQuote = useQuoteStore((s) => s.deleteQuote)
  const contactContracts = useContractsForContact(contact.id)
  const contactPayments = usePaymentsForContact(contact.id)
  const contactInvoices = useInvoicesForContact(contact.id)
  const fetchContracts = useContractStore((s) => s.fetchContracts)
  const fetchPayments = useContractStore((s) => s.fetchPayments)
  const [users, setUsers] = useState<User[]>([])
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email || '',
    phone: contact.phone || '',
    company: contact.company || '',
    address: contact.address || '',
    city: contact.city || '',
    state: contact.state || '',
    zip: contact.zip || '',
    lead_source: contact.lead_source,
    notes: contact.notes || '',
  })
  const [billingActionWorking, setBillingActionWorking] = useState<string | null>(null)
  const [billingActionResult, setBillingActionResult] = useState<{ status: string; message: string } | null>(null)
  const [billingActionsDismissed, setBillingActionsDismissed] = useState(false)
  const [viewingQuote, setViewingQuote] = useState<typeof contactQuotes[number] | null>(null)
  const [showInlineTask, setShowInlineTask] = useState(false)
  const [inlineTaskTitle, setInlineTaskTitle] = useState('')
  const [inlineTaskType, setInlineTaskType] = useState<TaskType>('follow_up')
  const [inlineTaskDue, setInlineTaskDue] = useState(new Date().toISOString().split('T')[0])

  // Fetch org users for owner name resolution
  useEffect(() => { usersApi.list().then((r) => setUsers(r.items)).catch(() => {}) }, [])

  // Fetch activities for this contact
  useEffect(() => { fetchActivities(contact.id) }, [contact.id, fetchActivities])
  // Ensure pipeline data is loaded for deals display
  useEffect(() => { fetchPipelines() }, [fetchPipelines])
  useEffect(() => {
    if (activePipelineId) fetchDeals(activePipelineId)
  }, [activePipelineId, fetchDeals])
  // Ensure tasks are loaded
  useEffect(() => { fetchTasks() }, [fetchTasks])
  useEffect(() => { fetchQuotes() }, [fetchQuotes])
  useEffect(() => { fetchContracts() }, [fetchContracts])
  useEffect(() => { fetchPayments({ contact_id: contact.id }) }, [contact.id, fetchPayments])

  const contactActivities = activities.filter((a) => a.contact_id === contact.id)
  const contactDeals = deals.filter((d) => d.contact_id === contact.id)
  const contactQuotes = allQuotes.filter((q) => q.contact_id === contact.id)

  function handleMoveDeal(dealId: string, newStageId: string) {
    scheduling.interceptMoveDeal(dealId, newStageId, contact.id, `${contact.first_name} ${contact.last_name}`)
    // Refresh activities after a short delay to catch the stage change
    setTimeout(() => fetchActivities(contact.id), 500)
  }

  async function handleAddInlineTask() {
    if (!inlineTaskTitle.trim()) return
    try {
      await addTask({
        contact_id: contact.id,
        deal_id: contactDeals[0]?.id || undefined,
        title: inlineTaskTitle.trim(),
        type: inlineTaskType,
        priority: 'medium',
        status: 'pending',
        due_date: inlineTaskDue || undefined,
      })
      setInlineTaskTitle('')
      setInlineTaskType('follow_up')
      setShowInlineTask(false)
      fetchTasks()
      fetchActivities(contact.id)
    } catch (e) {
      console.error('Failed to add task:', e)
    }
  }

  // Subscription summary calculations
  const activeContract = contactContracts.find((c) => c.status === 'active')
  const totalRevenue = contactPayments
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0)
  const failedCount = contactPayments.filter((p) => p.status === 'failed').length
  const paymentHealth: 'green' | 'yellow' | 'red' =
    failedCount >= 2 ? 'red' : failedCount === 1 ? 'yellow' : 'green'
  const paymentHealthColors = { green: 'text-success', yellow: 'text-warning', red: 'text-danger' }
  const paymentHealthLabels = { green: 'Current', yellow: '1 Missed', red: 'Past Due' }
  const tenure = activeContract?.start_date
    ? Math.max(1, Math.round((new Date().getTime() - new Date(activeContract.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : 0

  // Accepted quote equipment owed — used by BillingConsole to pre-fill charge amount
  const acceptedQuoteEquipmentTotal = (() => {
    const accepted = contactQuotes.filter((q) => q.status === 'accepted')
    const totalEquipmentQuoted = accepted.reduce((sum, q) => sum + q.equipment_total, 0)
    const totalPaid = contactPayments.filter((p) => p.status === 'succeeded').reduce((sum, p) => sum + p.amount, 0)
    return Math.max(0, totalEquipmentQuoted - totalPaid)
  })()

  return (
    <div>
      {/* Top bar */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-body"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Contacts
        </button>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-body shadow-card transition-colors hover:bg-page"
          >
            <Edit className="h-3.5 w-3.5 text-muted-foreground" />
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await updateContact(contact.id, editForm)
                setEditing(false)
              }}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditForm({
                  first_name: contact.first_name,
                  last_name: contact.last_name,
                  email: contact.email || '',
                  phone: contact.phone || '',
                  company: contact.company || '',
                  address: contact.address || '',
                  city: contact.city || '',
                  state: contact.state || '',
                  zip: contact.zip || '',
                  lead_source: contact.lead_source,
                  notes: contact.notes || '',
                })
                setEditing(false)
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-page"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        {/* Left column: static info */}
        <div className="space-y-4">
          {/* Contact header card */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-card">
            {!editing ? (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-heading">
                      {contact.first_name} {contact.last_name}
                    </h2>
                    {contact.company && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{contact.company}</p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      statusColors[contact.status] ?? statusColors.active
                    }`}
                  >
                    {CONTACT_STATUS_LABELS[contact.status]}
                  </span>
                </div>

                <div className="mt-4 space-y-2.5">
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
              </>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} placeholder="First name" className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-heading outline-none focus:border-primary" />
                  <input type="text" value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} placeholder="Last name" className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-heading outline-none focus:border-primary" />
                </div>
                <input type="text" value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} placeholder="Company" className="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-heading outline-none focus:border-primary" />
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Email" className="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-heading outline-none focus:border-primary" />
                <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Phone" className="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-heading outline-none focus:border-primary" />
                <input type="text" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="Address" className="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-heading outline-none focus:border-primary" />
                <div className="grid grid-cols-3 gap-3">
                  <input type="text" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} placeholder="City" className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-heading outline-none focus:border-primary" />
                  <input type="text" value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} placeholder="ST" maxLength={2} className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-heading outline-none focus:border-primary" />
                  <input type="text" value={editForm.zip} onChange={(e) => setEditForm({ ...editForm, zip: e.target.value })} placeholder="Zip" className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-heading outline-none focus:border-primary" />
                </div>
                <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Notes" rows={2} className="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-heading outline-none focus:border-primary resize-none" />
              </div>
            )}

            {/* Meta fields */}
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border pt-4">
              <Field label="Owner" value={(() => {
                if (!contact.assigned_to) return 'Unassigned'
                const user = users.find((u) => u.id === contact.assigned_to)
                return user ? `${user.first_name} ${user.last_name}` : 'Unassigned'
              })()} />
              <Field label="Source" value={LEAD_SOURCE_LABELS[contact.lead_source]} />
              <Field
                label="Property"
                value={contact.property_type ? PROPERTY_TYPE_LABELS[contact.property_type] : 'N/A'}
              />
              <Field label="Created" value={format(new Date(contact.created_at), 'MMM d, yyyy')} />
            </div>

            {/* Tags */}
            {contact.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                {contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Deals card */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {dealLabel.plural}
            </h3>
            {contactDeals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No {dealLabel.pluralLower}</p>
            ) : (
              <div className="space-y-2">
                {contactDeals.map((deal) => {
                  const stage = stages.find((s) => s.id === deal.stage_id)
                  return (
                    <div
                      key={deal.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-heading">{deal.title}</p>
                        <div className="mt-0.5">
                          <select
                            value={deal.stage_id}
                            onChange={(e) => handleMoveDeal(deal.id, e.target.value)}
                            className="rounded-full border-0 px-2 py-0.5 text-[10px] font-medium text-white outline-none cursor-pointer"
                            style={{ backgroundColor: stage?.color ?? '#6C63FF' }}
                          >
                            {stages
                              .filter((s) => s.pipeline_id === deal.pipeline_id && s.is_active)
                              .sort((a, b) => a.sort_order - b.sort_order)
                              .map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                          </select>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-primary">
                        ${deal.estimated_value.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quotes card */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quotes</h3>
              <button
                onClick={() => setShowQuoteBuilder(true)}
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-hover"
              >
                <Plus className="h-3 w-3" /> New
              </button>
            </div>
            {contactQuotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quotes yet</p>
            ) : (
              <div className="space-y-2">
                {contactQuotes
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 5)
                  .map((quote) => (
                    <div key={quote.id} className="rounded-lg border border-border p-2.5">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-heading truncate">{quote.title}</p>
                          <span className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${quoteStatusColors[quote.status] ?? quoteStatusColors.draft}`}>
                            {QUOTE_STATUS_LABELS[quote.status]}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-primary flex-shrink-0">
                          {currencyFormat.format(quote.equipment_total)}
                        </span>
                      </div>
                      {quote.monthly_monitoring_amount > 0 && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          + {currencyFormat.format(quote.monthly_monitoring_amount)}/mo monitoring
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-1.5">
                        {quote.status === 'draft' && (
                          <button
                            onClick={async (e) => { e.stopPropagation(); await sendQuote(quote.id); fetchActivities(contact.id) }}
                            className="rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-white hover:bg-primary-hover"
                          >
                            Send
                          </button>
                        )}
                        {quote.status === 'sent' && (
                          <>
                            <button
                              onClick={async (e) => { e.stopPropagation(); await acceptQuote(quote.id); fetchActivities(contact.id) }}
                              className="rounded bg-success/90 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-success"
                            >
                              Accept
                            </button>
                            <button
                              onClick={async (e) => { e.stopPropagation(); await declineQuote(quote.id); fetchActivities(contact.id) }}
                              className="rounded bg-danger/90 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-danger"
                            >
                              Decline
                            </button>
                            <button
                              onClick={async (e) => { e.stopPropagation(); await sendQuote(quote.id); fetchActivities(contact.id) }}
                              className="rounded border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-heading"
                            >
                              Resend
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setViewingQuote(quote)}
                          className="rounded border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-heading"
                        >
                          View
                        </button>
                        <button
                          onClick={async (e) => { e.stopPropagation(); await deleteQuote(quote.id) }}
                          className="rounded border border-border px-2 py-0.5 text-[10px] font-medium text-danger/70 hover:text-danger hover:border-danger/30"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Subscription summary card */}
          {activeContract && (
            <div className="rounded-xl border border-border bg-white p-5 shadow-card">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Subscription
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Monthly Amount</dt>
                  <dd className="mt-0.5 text-lg font-bold text-primary">{currencyFormat.format(activeContract.monthly_amount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Payment Health</dt>
                  <dd className={`mt-0.5 text-sm font-semibold ${paymentHealthColors[paymentHealth]}`}>
                    {paymentHealthLabels[paymentHealth]}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Tenure</dt>
                  <dd className="mt-0.5 text-sm font-medium text-heading">{tenure} months</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Lifetime Revenue</dt>
                  <dd className="mt-0.5 text-sm font-medium text-heading">{currencyFormat.format(totalRevenue)}</dd>
                </div>
              </div>
            </div>
          )}

          {/* Tasks card */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tasks
              </h3>
              <button
                onClick={() => setShowInlineTask(true)}
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-hover"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            {showInlineTask && (
              <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={inlineTaskTitle}
                    onChange={(e) => setInlineTaskTitle(e.target.value)}
                    placeholder="Task title"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleAddInlineTask()}
                    className="flex-1 min-w-0 bg-transparent text-xs text-heading outline-none placeholder:text-placeholder"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={inlineTaskType}
                    onChange={(e) => setInlineTaskType(e.target.value as TaskType)}
                    className="rounded border border-border bg-white px-1.5 py-0.5 text-[10px] text-body outline-none"
                  >
                    {Object.entries(TASK_TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={inlineTaskDue}
                    onChange={(e) => setInlineTaskDue(e.target.value)}
                    className="rounded border border-border bg-white px-1.5 py-0.5 text-[10px] text-body outline-none"
                  />
                  <button
                    onClick={handleAddInlineTask}
                    disabled={!inlineTaskTitle.trim()}
                    className="rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowInlineTask(false)}
                    className="text-[10px] text-muted-foreground hover:text-heading"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {contactTasks.length === 0 && !showInlineTask ? (
              <p className="text-sm text-muted-foreground">No tasks</p>
            ) : (
              <div className="space-y-2">
                {contactTasks
                  .filter((t) => t.status !== 'cancelled')
                  .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
                  .map((task) => {
                    const dueDate = task.due_date ? new Date(task.due_date) : null
                    const isOverdue = dueDate && task.status !== 'completed' && isPast(dueDate) && !isToday(dueDate)
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 rounded-lg border border-border p-2.5"
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
                            <span className="text-[10px] text-muted-foreground">{TASK_PRIORITY_LABELS[task.priority]}</span>
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

          {/* Invoices card */}
          {contactInvoices.length > 0 && (
            <div className="rounded-xl border border-border bg-white p-5 shadow-card">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Invoices
              </h3>
              <div className="space-y-2">
                {contactInvoices
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 5)
                  .map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-lg border border-border p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-heading truncate">{inv.invoice_number}</p>
                        <span className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${INVOICE_STATUS_COLORS[inv.status]}`}>
                          {INVOICE_STATUS_LABELS[inv.status]}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-primary flex-shrink-0">${inv.total.toFixed(2)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Payment History card */}
          {contactPayments.length > 0 && (
            <div className="rounded-xl border border-border bg-white p-5 shadow-card">
              <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <CreditCard className="h-3.5 w-3.5" />
                Payment History
              </h3>
              <div className="space-y-2">
                {contactPayments
                  .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
                  .slice(0, 5)
                  .map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-heading">
                          {payment.status === 'succeeded' ? 'Upfront charge approved' : payment.status === 'failed' ? 'Charge attempt failed' : 'Payment'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(payment.payment_date), 'MMM d, yyyy')}
                        </p>
                        {payment.payment_method_last4 && (
                          <p className="mt-1 truncate text-[10px] text-muted-foreground">
                            Card •••• {payment.payment_method_last4}
                          </p>
                        )}
                        {payment.failure_message && (
                          <p className="mt-1 truncate text-[10px] text-danger">{payment.failure_message}</p>
                        )}
                      </div>
                      <div className="ml-3 text-right">
                        <p className="text-xs font-medium text-heading">${payment.amount.toFixed(2)}</p>
                        <p className={`text-[10px] font-medium ${
                          payment.status === 'succeeded' ? 'text-success' :
                          payment.status === 'failed' ? 'text-danger' : 'text-muted-foreground'
                        }`}>
                          {payment.status === 'succeeded' ? 'Paid' : payment.status === 'failed' ? 'Failed' : payment.status}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Notes card */}
          {contact.notes && (
            <div className="rounded-xl border border-border bg-white p-5 shadow-card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notes
              </h3>
              <p className="text-sm leading-relaxed text-body">{contact.notes}</p>
            </div>
          )}
        </div>

        {/* Right column: billing actions + billing console + activity timeline */}
        <div className="space-y-4">
          {/* Billing Actions Needed */}
          {(() => {
            if (billingActionsDismissed) return null
            const acceptedQuotes = contactQuotes.filter((q) => q.status === 'accepted')
            const totalEquipmentQuoted = acceptedQuotes.reduce((sum, q) => sum + q.equipment_total, 0)
            const totalEquipmentPaid = contactPayments
              .filter((p) => p.status === 'succeeded')
              .reduce((sum, p) => sum + p.amount, 0)
            const equipmentOwed = totalEquipmentQuoted - totalEquipmentPaid
            const hasMonitoringQuoted = acceptedQuotes.some((q) => q.monthly_monitoring_amount > 0)
            const monitoringAmount = acceptedQuotes.find((q) => q.monthly_monitoring_amount > 0)?.monthly_monitoring_amount ?? 0
            const hasActiveSubscription = Boolean(activeContract)

            // Check if monitoring subscription exists but first month hasn't been charged
            // Look for ANY successful payment matching the monitoring amount (not just subscription-linked)
            const hasMonitoringPayment = contactPayments.some(
              (p) => p.status === 'succeeded' && Math.abs(p.amount - monitoringAmount) < 0.01
            )
            const needsFirstMonthCharge = hasActiveSubscription && monitoringAmount > 0 && !hasMonitoringPayment

            if (acceptedQuotes.length === 0) return null
            const hasEquipment = equipmentOwed > 0
            const hasMonitoring = hasMonitoringQuoted && !hasActiveSubscription
            if (!hasEquipment && !hasMonitoring && !needsFirstMonthCharge) return null

            async function handleChargeEquipment() {
              setBillingActionWorking('equipment')
              setBillingActionResult(null)
              try {
                const result = await authnetApi.charge({
                  contact_id: contact.id,
                  amount: Math.round(equipmentOwed * 100) / 100,
                  description: 'Equipment & installation charge',
                })
                if (result.status === 'succeeded') {
                  setBillingActionResult({ status: 'success', message: `Charged ${currencyFormat.format(result.amount)} successfully. Invoice sent.` })
                  setTimeout(() => setBillingActionsDismissed(true), 3000)
                  fetchPayments({ contact_id: contact.id })
                  fetchActivities(contact.id)
                } else {
                  setBillingActionResult({ status: 'error', message: result.failure_message || 'Charge declined' })
                }
              } catch (e) {
                setBillingActionResult({ status: 'error', message: e instanceof Error ? e.message : 'Charge failed' })
              } finally {
                setBillingActionWorking(null)
              }
            }

            return (
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 shadow-card">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Billing Actions Needed
                </h3>

                {billingActionResult && (
                  <div className={`mt-2 rounded-md border px-3 py-1.5 text-xs ${
                    billingActionResult.status === 'success' ? 'border-success/20 bg-success/5 text-success' : 'border-danger/20 bg-danger/5 text-danger'
                  }`}>
                    {billingActionResult.message}
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  {hasEquipment && (
                    <div className="flex items-center justify-between rounded-lg bg-white border border-border px-3 py-2">
                      <div>
                        <p className="text-xs font-medium text-heading">Equipment & install: {currencyFormat.format(equipmentOwed)}</p>
                        <p className="text-[10px] text-muted-foreground">Card on file will be charged</p>
                      </div>
                      <button
                        onClick={handleChargeEquipment}
                        disabled={billingActionWorking !== null}
                        className="rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                      >
                        {billingActionWorking === 'equipment' ? 'Charging...' : `Charge ${currencyFormat.format(equipmentOwed)}`}
                      </button>
                    </div>
                  )}
                  {hasMonitoring && (
                    <div className="flex items-center justify-between rounded-lg bg-white border border-border px-3 py-2">
                      <div>
                        <p className="text-xs font-medium text-heading">Monthly monitoring: {currencyFormat.format(monitoringAmount)}/mo</p>
                        <p className="text-[10px] text-muted-foreground">Subscription not yet active</p>
                      </div>
                      <button
                        onClick={() => {
                          const el = document.querySelector('[data-billing-manage]')
                          if (el instanceof HTMLElement) el.click()
                        }}
                        className="rounded-md border border-border px-3 py-1 text-[11px] font-medium text-heading hover:bg-page"
                      >
                        Set Up
                      </button>
                    </div>
                  )}
                  {needsFirstMonthCharge && (
                    <div className="flex items-center justify-between rounded-lg bg-white border border-border px-3 py-2">
                      <div>
                        <p className="text-xs font-medium text-heading">First month monitoring: {currencyFormat.format(monitoringAmount)}</p>
                        <p className="text-[10px] text-muted-foreground">Subscription active - charge first month now</p>
                      </div>
                      <button
                        onClick={async () => {
                          setBillingActionWorking('monitoring')
                          setBillingActionResult(null)
                          try {
                            const result = await authnetApi.charge({
                              contact_id: contact.id,
                              amount: Math.round(monitoringAmount * 100) / 100,
                              description: 'Monthly monitoring - first month',
                            })
                            if (result.status === 'succeeded') {
                              setBillingActionResult({ status: 'success', message: `Charged ${currencyFormat.format(result.amount)} for first month. Invoice sent.` })
                              setTimeout(() => setBillingActionsDismissed(true), 3000)
                              fetchPayments({ contact_id: contact.id })
                              fetchActivities(contact.id)
                            } else {
                              setBillingActionResult({ status: 'error', message: result.failure_message || 'Charge declined' })
                            }
                          } catch (e) {
                            setBillingActionResult({ status: 'error', message: e instanceof Error ? e.message : 'Charge failed' })
                          } finally {
                            setBillingActionWorking(null)
                          }
                        }}
                        disabled={billingActionWorking !== null}
                        className="rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                      >
                        {billingActionWorking === 'monitoring' ? 'Charging...' : `Charge ${currencyFormat.format(monitoringAmount)}`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          <BillingConsole
            contact={contact}
            onRefreshBilling={() => {
              fetchContracts()
              fetchPayments({ contact_id: contact.id })
              fetchActivities(contact.id)
            }}
            acceptedQuoteTotal={acceptedQuoteEquipmentTotal}
          />

          <div className="rounded-xl border border-border bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Activity Timeline
              </h3>
            </div>

            {/* Quick actions */}
            <div className="mb-5">
              <QuickActions contactId={contact.id} />
            </div>

            <ActivityTimeline activities={contactActivities} />
          </div>
        </div>
      </div>

      <SchedulingModal {...scheduling} />

      {showQuoteBuilder && (
        <QuoteBuilder
          onClose={() => { setShowQuoteBuilder(false); fetchQuotes() }}
          defaultContactId={contact.id}
          defaultDealId={contactDeals[0]?.id}
        />
      )}

      {viewingQuote && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setViewingQuote(null)} />
          <div className="fixed inset-x-0 top-[5%] bottom-[5%] z-50 mx-auto w-full max-w-lg overflow-y-auto">
            <div className="mx-4 rounded-2xl bg-white shadow-modal">
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-5 py-3 rounded-t-2xl">
                <div>
                  <h3 className="text-sm font-semibold text-heading">{viewingQuote.title}</h3>
                  <span className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${quoteStatusColors[viewingQuote.status] ?? quoteStatusColors.draft}`}>
                    {QUOTE_STATUS_LABELS[viewingQuote.status]}
                  </span>
                </div>
                <button onClick={() => setViewingQuote(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-page hover:text-heading">
                  <span className="text-lg">&times;</span>
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Equipment lines */}
                {viewingQuote.equipment_lines && viewingQuote.equipment_lines.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Equipment & Installation</h4>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-page/50 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            <th className="px-3 py-1.5 text-left">Item</th>
                            <th className="px-3 py-1.5 text-center w-12">Qty</th>
                            <th className="px-3 py-1.5 text-right w-20">Price</th>
                            {viewingQuote.equipment_lines.some((l: Record<string, unknown>) => (l.discount as number) > 0) && (
                              <th className="px-3 py-1.5 text-center w-16">Disc.</th>
                            )}
                            <th className="px-3 py-1.5 text-right w-20">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewingQuote.equipment_lines.map((line, i) => {
                            const disc = (line as Record<string, unknown>).discount as number || 0
                            const hasAnyDiscount = viewingQuote.equipment_lines!.some((l: Record<string, unknown>) => (l.discount as number) > 0)
                            return (
                              <tr key={i} className="border-t border-border">
                                <td className="px-3 py-1.5 text-heading">{line.product_name || 'Item'}</td>
                                <td className="px-3 py-1.5 text-center text-muted-foreground">{line.quantity}</td>
                                <td className="px-3 py-1.5 text-right text-heading">{currencyFormat.format(line.unit_price)}</td>
                                {hasAnyDiscount && (
                                  <td className="px-3 py-1.5 text-center text-success">{disc > 0 ? `${disc}%` : '-'}</td>
                                )}
                                <td className="px-3 py-1.5 text-right font-medium text-heading">{currencyFormat.format(line.total)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-border bg-page/30">
                            <td colSpan={viewingQuote.equipment_lines.some((l: Record<string, unknown>) => (l.discount as number) > 0) ? 4 : 3} className="px-3 py-1.5 font-semibold text-heading">Total</td>
                            <td className="px-3 py-1.5 text-right font-bold text-heading">{currencyFormat.format(viewingQuote.equipment_total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Monitoring */}
                {viewingQuote.monthly_monitoring_amount > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-page/50 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Monthly Monitoring</span>
                    <span className="font-bold text-heading">{currencyFormat.format(viewingQuote.monthly_monitoring_amount)}/mo</span>
                  </div>
                )}

                {/* Notes */}
                {viewingQuote.notes && (
                  <div>
                    <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</h4>
                    <p className="text-xs text-body leading-relaxed">{viewingQuote.notes}</p>
                  </div>
                )}

                {/* Dates */}
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span>Created {format(new Date(viewingQuote.created_at), 'MMM d, yyyy')}</span>
                  {viewingQuote.sent_at && <span>Sent {format(new Date(viewingQuote.sent_at), 'MMM d, yyyy')}</span>}
                  {viewingQuote.accepted_at && <span>Accepted {format(new Date(viewingQuote.accepted_at), 'MMM d, yyyy')}</span>}
                </div>
              </div>

              {/* Actions footer */}
              <div className="sticky bottom-0 border-t border-border bg-white px-5 py-3 rounded-b-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Status actions */}
                  {(viewingQuote.status === 'draft' || viewingQuote.status === 'sent') && (
                    <button
                      onClick={async () => { await sendQuote(viewingQuote.id); fetchQuotes(); fetchActivities(contact.id); setViewingQuote(null) }}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
                    >
                      {viewingQuote.status === 'sent' ? 'Resend Quote' : 'Send to Customer'}
                    </button>
                  )}
                  {viewingQuote.status === 'sent' && (
                    <>
                      <button
                        onClick={async () => { await acceptQuote(viewingQuote.id); fetchQuotes(); fetchActivities(contact.id); setViewingQuote(null) }}
                        className="rounded-md bg-success/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-success"
                      >
                        Mark Accepted
                      </button>
                      <button
                        onClick={async () => { await declineQuote(viewingQuote.id); fetchQuotes(); fetchActivities(contact.id); setViewingQuote(null) }}
                        className="rounded-md bg-danger/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-danger"
                      >
                        Mark Declined
                      </button>
                    </>
                  )}

                  {/* Edit & resend — opens QuoteBuilder pre-filled, user edits, then sends */}
                  {(viewingQuote.status === 'draft' || viewingQuote.status === 'sent' || viewingQuote.status === 'rejected') && (
                    <button
                      onClick={() => { setViewingQuote(null); setShowQuoteBuilder(true) }}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-heading hover:bg-page"
                    >
                      Edit & Resend
                    </button>
                  )}

                  {/* PDF */}
                  <button
                    onClick={async () => {
                      const blob = await quotesApi.getPdf(viewingQuote.id)
                      const url = URL.createObjectURL(blob)
                      window.open(url, '_blank')
                    }}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-heading hover:bg-page"
                  >
                    Download PDF
                  </button>

                  {/* Delete */}
                  <button
                    onClick={async () => { await deleteQuote(viewingQuote.id); setViewingQuote(null) }}
                    className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs font-medium text-danger/70 hover:text-danger hover:border-danger/30"
                  >
                    Delete Quote
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
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
