import { format, isPast, isToday } from 'date-fns'
import { CheckCircle2, Clock, AlertTriangle, User, Calendar, Tag, Flag } from 'lucide-react'
import type { Task } from '@/types/task'
import { TASK_TYPE_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/types/task'
import useContactStore from '@/stores/contactStore'
import useTaskStore from '@/stores/taskStore'

const priorityColors: Record<string, string> = {
  urgent: 'bg-danger/10 text-danger',
  high: 'bg-warning/10 text-warning',
  medium: 'bg-info/10 text-info',
  low: 'bg-muted text-muted-foreground',
}

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  in_progress: 'bg-info/10 text-info',
  completed: 'bg-success/10 text-success',
  cancelled: 'bg-muted text-muted-foreground',
}

interface TaskDetailPanelProps {
  task: Task
}

export default function TaskDetailPanel({ task }: TaskDetailPanelProps) {
  const contacts = useContactStore((s) => s.contacts)
  const completeTask = useTaskStore((s) => s.completeTask)

  const contact = task.contact_id
    ? contacts.find((c) => c.id === task.contact_id)
    : null

  const dueDate = new Date(task.due_date)
  const isOverdue = task.status !== 'completed' && task.status !== 'cancelled' && isPast(dueDate) && !isToday(dueDate)
  const isDueToday = isToday(dueDate)

  return (
    <div className="space-y-6">
      {/* Title + status */}
      <div>
        <h3 className="text-xl font-bold text-heading">{task.title}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[task.status]}`}>
            {TASK_STATUS_LABELS[task.status]}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColors[task.priority]}`}>
            <Flag className="h-3 w-3" />
            {TASK_PRIORITY_LABELS[task.priority]}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-page px-2.5 py-0.5 text-xs font-medium text-body">
            <Tag className="h-3 w-3" />
            {TASK_TYPE_LABELS[task.type]}
          </span>
        </div>
      </div>

      {/* Complete button */}
      {(task.status === 'pending' || task.status === 'in_progress') && (
        <button
          onClick={() => completeTask(task.id)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-success/90"
        >
          <CheckCircle2 className="h-4 w-4" />
          Mark Complete
        </button>
      )}

      {/* Details grid */}
      <div className="rounded-lg border border-border bg-page/50 p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Details
        </h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field
            icon={Calendar}
            label="Due Date"
            value={format(dueDate, 'MMM d, yyyy')}
            valueClass={isOverdue ? 'text-danger font-medium' : isDueToday ? 'text-warning font-medium' : ''}
          />
          {task.due_time && (
            <Field icon={Clock} label="Time" value={task.due_time} />
          )}
          <Field icon={User} label="Assigned To" value={task.assigned_to ?? 'Unassigned'} />
          <Field icon={User} label="Created By" value={task.created_by} />
          <div>
            <dt className="text-xs text-muted-foreground">Duration</dt>
            <dd className="mt-0.5 text-sm font-medium text-heading">{task.duration_minutes} min</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Created</dt>
            <dd className="mt-0.5 text-sm font-medium text-heading">
              {format(new Date(task.created_at), 'MMM d, yyyy')}
            </dd>
          </div>
        </div>
      </div>

      {/* Overdue warning */}
      {isOverdue && (
        <div className="flex items-center gap-2 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          This task is overdue
        </div>
      )}

      {/* Description */}
      {task.description && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Description
          </h4>
          <p className="text-sm leading-relaxed text-body">{task.description}</p>
        </div>
      )}

      {/* Linked contact */}
      {contact && (
        <div className="rounded-lg border border-border bg-page/50 p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Contact
          </h4>
          <p className="text-sm font-medium text-heading">
            {contact.first_name} {contact.last_name}
          </p>
          {contact.company && (
            <p className="text-xs text-muted-foreground">{contact.company}</p>
          )}
          <p className="mt-1 text-xs text-body">{contact.email}</p>
          <p className="text-xs text-body">{contact.phone}</p>
        </div>
      )}

      {/* Completion info */}
      {task.status === 'completed' && task.completed_at && (
        <div className="rounded-lg border border-success/20 bg-success/5 p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-success">
            Completed
          </h4>
          <p className="text-sm text-body">
            By {task.completed_by} on {format(new Date(task.completed_at), 'MMM d, yyyy')}
          </p>
        </div>
      )}
    </div>
  )
}

function Field({
  icon: Icon,
  label,
  value,
  valueClass = '',
}: {
  icon: typeof Clock
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </dt>
      <dd className={`mt-0.5 text-sm font-medium text-heading ${valueClass}`}>{value}</dd>
    </div>
  )
}
