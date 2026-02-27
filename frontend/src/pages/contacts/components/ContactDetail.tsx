import { format, isPast, isToday } from 'date-fns'
import { ArrowLeft, Mail, Phone, MapPin, Edit, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { Contact } from '@/types/contact'
import {
  LEAD_SOURCE_LABELS,
  CONTACT_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
} from '@/types/contact'
import { TASK_TYPE_LABELS, TASK_PRIORITY_LABELS } from '@/types/task'
import useContactStore from '@/stores/contactStore'
import usePipelineStore from '@/stores/pipelineStore'
import useTaskStore, { useTasksForContact } from '@/stores/taskStore'
import { useContractsForContact, usePaymentsForContact } from '@/stores/contractStore'
import ActivityTimeline from './ActivityTimeline'
import QuickActions from './QuickActions'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

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
  const activities = useContactStore((s) => s.activities)
  const deals = usePipelineStore((s) => s.deals)
  const stages = usePipelineStore((s) => s.stages)
  const contactTasks = useTasksForContact(contact.id)
  const completeTask = useTaskStore((s) => s.completeTask)
  const contactContracts = useContractsForContact(contact.id)
  const contactPayments = usePaymentsForContact(contact.id)

  const contactActivities = activities.filter((a) => a.contact_id === contact.id)
  const contactDeals = deals.filter((d) => d.contact_id === contact.id)

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
  const tenure = activeContract
    ? Math.max(1, Math.round((new Date().getTime() - new Date(activeContract.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : 0

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
        <button className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-body shadow-card transition-colors hover:bg-page">
          <Edit className="h-3.5 w-3.5 text-muted-foreground" />
          Edit
        </button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        {/* Left column: static info */}
        <div className="space-y-4">
          {/* Contact header card */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-card">
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

            {/* Meta fields */}
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border pt-4">
              <Field label="Owner" value={contact.assigned_to ?? 'Unassigned'} />
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
              Deals
            </h3>
            {contactDeals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals</p>
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
                        <div className="mt-0.5 flex items-center gap-2">
                          {stage && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                              style={{ backgroundColor: stage.color }}
                            >
                              {stage.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-primary">
                        ${deal.value.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
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
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tasks
            </h3>
            {contactTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks</p>
            ) : (
              <div className="space-y-2">
                {contactTasks
                  .filter((t) => t.status !== 'cancelled')
                  .sort((a, b) => a.due_date.localeCompare(b.due_date))
                  .map((task) => {
                    const dueDate = new Date(task.due_date)
                    const isOverdue = task.status !== 'completed' && isPast(dueDate) && !isToday(dueDate)
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
                          {format(dueDate, 'MMM d')}
                        </span>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

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

        {/* Right column: activity timeline */}
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
