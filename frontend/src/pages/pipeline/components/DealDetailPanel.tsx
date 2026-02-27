import { useState } from 'react'
import { differenceInDays, format, isPast, isToday } from 'date-fns'
import { Mail, Phone, MapPin, CheckCircle2, AlertTriangle, Plus } from 'lucide-react'
import type { DealWithContact, PipelineStage } from '@/types/pipeline'
import { useEntityLabels } from '@/hooks/useEntityLabels'
import { TASK_TYPE_LABELS, TASK_PRIORITY_LABELS } from '@/types/task'
import { useTasksForDeal } from '@/stores/taskStore'
import useTaskStore from '@/stores/taskStore'
import CreateTaskModal from '@/pages/tasks/components/CreateTaskModal'

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

export default function DealDetailPanel({ deal, stage }: DealDetailPanelProps) {
  const { deal: dealLabel } = useEntityLabels()
  const { contact } = deal
  const daysInStage = differenceInDays(new Date(), new Date(deal.updated_at))
  const dealTasks = useTasksForDeal(deal.id)
  const completeTask = useTaskStore((s) => s.completeTask)
  const [showCreateTask, setShowCreateTask] = useState(false)

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
          <Field label="Assigned To" value={deal.assigned_to ?? 'Unassigned'} />
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
                    {format(dueDate, 'MMM d')}
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

      {/* Activity timeline placeholder */}
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Activity
        </h4>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-border" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded bg-border" />
                <div className="h-3 w-1/2 rounded bg-border" />
              </div>
            </div>
          ))}
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
