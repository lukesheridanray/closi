import { CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import { useTasksDueToday, useOverdueTasks } from '@/stores/taskStore'
import useTaskStore from '@/stores/taskStore'
import useContactStore from '@/stores/contactStore'
import { TASK_TYPE_LABELS } from '@/types/task'

export default function TasksDueToday() {
  const todayTasks = useTasksDueToday()
  const overdueTasks = useOverdueTasks()
  const completeTask = useTaskStore((s) => s.completeTask)
  const contacts = useContactStore((s) => s.contacts)
  const contactMap = new Map(contacts.map((c) => [c.id, c]))

  const allTasks = [...overdueTasks, ...todayTasks]

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-card">
      <h3 className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Tasks Due Today ({todayTasks.length})
        {overdueTasks.length > 0 && (
          <span className="ml-1 rounded-full bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger">
            {overdueTasks.length} overdue
          </span>
        )}
      </h3>
      {allTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks due today</p>
      ) : (
        <div className="space-y-2">
          {allTasks.map((task) => {
            const contact = task.contact_id ? contactMap.get(task.contact_id) : null
            const isOverdue = overdueTasks.some((t) => t.id === task.id)
            return (
              <div key={task.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5">
                <button
                  onClick={() => completeTask(task.id)}
                  className="flex-shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-success"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-heading truncate">{task.title}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{TASK_TYPE_LABELS[task.type]}</span>
                    {contact && (
                      <span className="text-[10px] text-muted-foreground">{contact.first_name} {contact.last_name}</span>
                    )}
                    {isOverdue && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-danger">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Overdue
                      </span>
                    )}
                  </div>
                </div>
                {task.due_time && (
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{task.due_time}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
