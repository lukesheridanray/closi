import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, CheckCircle2, AlertTriangle, Phone, Wrench, Calendar, ClipboardList } from 'lucide-react'
import { format, isPast, isToday, differenceInDays } from 'date-fns'
import useAuthStore from '@/stores/authStore'
import useLayoutStore from '@/stores/layoutStore'
import useContactStore from '@/stores/contactStore'
import useTaskStore from '@/stores/taskStore'
import { analyticsApi } from '@/lib/api'
import type { DashboardResponse } from '@/lib/api'
import type { Task } from '@/types/task'
import { TASK_TYPE_LABELS } from '@/types/task'
import { cn } from '@/lib/utils'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const typeIcons: Record<string, typeof Phone> = {
  call: Phone,
  site_visit: Calendar,
  install: Wrench,
  follow_up: ClipboardList,
  meeting: Calendar,
  email: ClipboardList,
  other: ClipboardList,
}

function formatOverviewValue(label: string, value: number | string) {
  if (typeof value !== 'number') return value
  const normalized = label.toLowerCase()
  const isCurrency =
    normalized.includes('revenue') ||
    normalized.includes('pipeline') ||
    normalized.includes('mrr') ||
    normalized.includes('value')
  return isCurrency ? currencyFormat.format(value) : String(value)
}

export default function SidebarPanel() {
  const navigate = useNavigate()
  const organization = useAuthStore((s) => s.organization)
  const open = useLayoutStore((s) => s.sidebarPanelOpen)
  const selectContact = useContactStore((s) => s.selectContact)
  const allTasks = useTaskStore((s) => s.tasks)
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const completeTask = useTaskStore((s) => s.completeTask)

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)

  useEffect(() => {
    fetchTasks()
    analyticsApi.getDashboard().then(setDashboard).catch(() => {})
  }, [fetchTasks])

  // Tasks that need attention: overdue first, then due today, then upcoming 7 days
  const actionableTasks = allTasks
    .filter((t) => t.status === 'pending' || t.status === 'in_progress')
    .filter((t) => t.due_date)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    .slice(0, 8)

  const overdueTasks = actionableTasks.filter((t) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)))
  const todayTasks = actionableTasks.filter((t) => t.due_date && isToday(new Date(t.due_date)))
  const upcomingTasks = actionableTasks.filter((t) => {
    if (!t.due_date) return false
    const d = new Date(t.due_date)
    return !isPast(d) && !isToday(d) && differenceInDays(d, new Date()) <= 7
  })

  function handleTaskClick(task: Task) {
    if (task.contact_id) {
      selectContact(task.contact_id)
      navigate('/contacts')
    } else {
      navigate('/tasks')
    }
  }

  function TaskItem({ task }: { task: Task }) {
    const Icon = typeIcons[task.type] ?? ClipboardList
    const dueDate = task.due_date ? new Date(task.due_date) : null
    const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate)

    return (
      <div className="flex items-start gap-2 rounded-lg border border-border p-2 text-left">
        <button
          onClick={(e) => { e.stopPropagation(); completeTask(task.id) }}
          className="mt-0.5 flex-shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-success"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => handleTaskClick(task)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-xs font-medium text-heading">{task.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Icon className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">{TASK_TYPE_LABELS[task.type]}</span>
            {dueDate && (
              <span className={`text-[10px] ${isOverdue ? 'text-danger font-medium' : 'text-muted-foreground'}`}>
                {isOverdue ? 'Overdue' : isToday(dueDate) ? 'Today' : format(dueDate, 'MMM d')}
              </span>
            )}
          </div>
        </button>
      </div>
    )
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-[60px] z-20 hidden w-[280px] border-r border-border bg-white transition-transform duration-200 xl:block',
        !open && 'xl:-translate-x-full',
      )}
    >
      <div className="flex h-full flex-col">
        {/* Org selector */}
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-heading">
              {organization?.name ?? 'My Organization'}
            </p>
            {organization?.city && organization?.state && (
              <p className="truncate text-xs text-muted-foreground">
                {organization.city}, {organization.state}
              </p>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Overdue */}
          {overdueTasks.length > 0 && (
            <>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-danger">
                <AlertTriangle className="h-3 w-3" />
                Overdue ({overdueTasks.length})
              </h3>
              <div className="mb-4 space-y-1.5">
                {overdueTasks.map((t) => <TaskItem key={t.id} task={t} />)}
              </div>
            </>
          )}

          {/* Today */}
          {todayTasks.length > 0 && (
            <>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Today ({todayTasks.length})
              </h3>
              <div className="mb-4 space-y-1.5">
                {todayTasks.map((t) => <TaskItem key={t.id} task={t} />)}
              </div>
            </>
          )}

          {/* Upcoming */}
          {upcomingTasks.length > 0 && (
            <>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Upcoming
              </h3>
              <div className="mb-4 space-y-1.5">
                {upcomingTasks.map((t) => <TaskItem key={t.id} task={t} />)}
              </div>
            </>
          )}

          {overdueTasks.length === 0 && todayTasks.length === 0 && upcomingTasks.length === 0 && (
            <div className="py-4 text-center">
              <CheckCircle2 className="mx-auto h-5 w-5 text-success" />
              <p className="mt-2 text-xs text-muted-foreground">All caught up</p>
            </div>
          )}

          {/* Overview metrics */}
          <h3 className="mb-3 mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Overview
          </h3>
          <div className="space-y-2">
            {dashboard ? (
              dashboard.kpis.slice(0, 4).map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-border p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{kpi.label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-heading">
                    {formatOverviewValue(kpi.label, kpi.value)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Loading...</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
