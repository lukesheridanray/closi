import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format, isPast, isToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, addMonths, subMonths, isSameDay } from 'date-fns'
import { Search, Plus, ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Flag, List, CalendarDays } from 'lucide-react'
import useTaskStore, { useFilteredTasks } from '@/stores/taskStore'
import useContactStore from '@/stores/contactStore'
import type { Task, TaskStatus, TaskPriority, TaskType } from '@/types/task'
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_TYPE_LABELS } from '@/types/task'
import DataTable, { type Column } from '@/components/shared/DataTable'
import CreateTaskModal from './components/CreateTaskModal'

const statusOptions: { value: TaskStatus | 'all' | 'open'; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'all', label: 'All Statuses' },
  ...Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({ value: value as TaskStatus, label })),
]

const priorityOptions: { value: TaskPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'All Priorities' },
  ...Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => ({ value: value as TaskPriority, label })),
]

const typeOptions: { value: TaskType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  ...Object.entries(TASK_TYPE_LABELS).map(([value, label]) => ({ value: value as TaskType, label })),
]

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

const typeColors: Record<string, { bg: string; text: string; dot: string }> = {
  site_visit: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  install:    { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  call:       { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  follow_up:  { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  meeting:    { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  email:      { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  other:      { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' },
}

export default function TasksAndCalendar() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const notificationsFilter = searchParams.get('filter') === 'notifications'
  const [localStatusFilter, setLocalStatusFilter] = useState<TaskStatus | 'all' | 'open'>(notificationsFilter ? 'open' : 'open')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createDate, setCreateDate] = useState<string | null>(null)
  const [selectedCalTask, setSelectedCalTask] = useState<Task | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Task list state
  const allTasks = useTaskStore((s) => s.tasks)
  const loading = useTaskStore((s) => s.loading)
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const search = useTaskStore((s) => s.search)
  const statusFilter = useTaskStore((s) => s.statusFilter)
  const priorityFilter = useTaskStore((s) => s.priorityFilter)
  const typeFilter = useTaskStore((s) => s.typeFilter)
  const sortField = useTaskStore((s) => s.sortField)
  const sortDir = useTaskStore((s) => s.sortDir)
  const completeTask = useTaskStore((s) => s.completeTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const setSearch = useTaskStore((s) => s.setSearch)
  const setStatusFilter = useTaskStore((s) => s.setStatusFilter)
  const setPriorityFilter = useTaskStore((s) => s.setPriorityFilter)
  const setTypeFilter = useTaskStore((s) => s.setTypeFilter)
  const setSort = useTaskStore((s) => s.setSort)
  const setPage = useTaskStore((s) => s.setPage)

  // Calendar state
  const calendarTasks = useTaskStore((s) => s.calendarTasks)
  const fetchCalendarTasks = useTaskStore((s) => s.fetchCalendarTasks)

  // Contacts for name resolution
  const contacts = useContactStore((s) => s.contacts)
  const fetchContacts = useContactStore((s) => s.fetchContacts)

  useEffect(() => { fetchTasks() }, [fetchTasks])
  useEffect(() => { fetchContacts() }, [fetchContacts])

  // Clear notifications filter param when user changes filters manually
  function clearNotificationsParam() {
    if (notificationsFilter) {
      searchParams.delete('filter')
      setSearchParams(searchParams, { replace: true })
    }
  }

  const { tasks: rawTasks, totalCount: rawTotalCount, totalPages, page } = useFilteredTasks()

  // Apply client-side status filter (open = hide completed/cancelled, notifications = overdue+today only)
  const { tasks, totalCount } = useMemo(() => {
    let filtered = rawTasks
    if (localStatusFilter === 'open') {
      filtered = filtered.filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
    } else if (localStatusFilter !== 'all') {
      filtered = filtered.filter((t) => t.status === localStatusFilter)
    }
    if (notificationsFilter) {
      filtered = filtered.filter((t) => {
        if (!t.due_date) return false
        const d = new Date(t.due_date)
        return isToday(d) || (isPast(d) && !isToday(d))
      })
    }
    return { tasks: filtered, totalCount: filtered.length }
  }, [rawTasks, localStatusFilter, notificationsFilter])
  const contactMap = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts])

  // Calendar grid
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  useEffect(() => {
    if (view === 'calendar') {
      fetchCalendarTasks(format(gridStart, 'yyyy-MM-dd'), format(gridEnd, 'yyyy-MM-dd'))
    }
  }, [view, currentMonth, fetchCalendarTasks])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    calendarTasks.forEach((t) => {
      if (!t.due_date) return
      const key = t.due_date.split('T')[0]
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    })
    return map
  }, [calendarTasks])

  const columns: Column<Task>[] = [
    {
      key: 'title',
      label: 'Task',
      sortable: true,
      render: (t) => {
        const dueDate = t.due_date ? new Date(t.due_date) : null
        const isOverdue = dueDate && t.status !== 'completed' && t.status !== 'cancelled' && isPast(dueDate) && !isToday(dueDate)
        return (
          <div className="flex items-center gap-2">
            {(t.status === 'pending' || t.status === 'in_progress') && (
              <button
                onClick={(e) => { e.stopPropagation(); completeTask(t.id) }}
                className="flex-shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-success"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
            {t.status === 'completed' && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success" />}
            <div>
              <p className={`font-medium ${t.status === 'completed' ? 'text-muted-foreground line-through' : 'text-heading'}`}>{t.title}</p>
              {isOverdue && (
                <span className="inline-flex items-center gap-0.5 text-xs text-danger">
                  <AlertTriangle className="h-3 w-3" /> Overdue
                </span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      key: 'type', label: 'Type', sortable: true, className: 'hidden md:table-cell',
      render: (t) => <span className="text-body">{TASK_TYPE_LABELS[t.type]}</span>,
    },
    {
      key: 'priority', label: 'Priority', sortable: true,
      render: (t) => (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[t.priority]}`}>
          <Flag className="h-3 w-3" /> {TASK_PRIORITY_LABELS[t.priority]}
        </span>
      ),
    },
    {
      key: 'status', label: 'Status', sortable: true, className: 'hidden md:table-cell',
      render: (t) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[t.status]}`}>
          {TASK_STATUS_LABELS[t.status]}
        </span>
      ),
    },
    {
      key: 'contact', label: 'Contact', className: 'hidden lg:table-cell',
      render: (t) => {
        if (!t.contact_id) return <span className="text-muted-foreground">--</span>
        const contact = contactMap.get(t.contact_id)
        return contact
          ? <span className="text-body">{contact.first_name} {contact.last_name}</span>
          : <span className="text-muted-foreground">--</span>
      },
    },
    {
      key: 'due_date', label: 'Due Date', sortable: true,
      render: (t) => {
        const dueDate = t.due_date ? new Date(t.due_date) : null
        const isOverdue = dueDate && t.status !== 'completed' && t.status !== 'cancelled' && isPast(dueDate) && !isToday(dueDate)
        const isDueToday = dueDate ? isToday(dueDate) : false
        return (
          <span className={`text-sm ${isOverdue ? 'text-danger font-medium' : isDueToday ? 'text-warning font-medium' : 'text-body'}`}>
            {!dueDate ? 'No date' : isDueToday ? 'Today' : format(dueDate, 'MMM d, yyyy')}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      {/* Header with view toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === 'list' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-heading hover:bg-page'
            }`}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === 'calendar' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-heading hover:bg-page'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Calendar
          </button>
        </div>

        <button
          onClick={() => view === 'calendar' ? setCreateDate(format(new Date(), 'yyyy-MM-dd')) : setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-card transition-colors hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" /> Add Task
        </button>
      </div>

      {/* Notifications banner */}
      {notificationsFilter && (
        <div className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/5 px-4 py-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium text-heading">Showing overdue and due-today tasks only</span>
          </div>
          <button
            onClick={() => { searchParams.delete('filter'); setSearchParams(searchParams, { replace: true }) }}
            className="text-xs font-medium text-primary hover:text-primary-hover"
          >
            Show all
          </button>
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-heading shadow-card outline-none placeholder:text-placeholder focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <FilterSelect value={localStatusFilter} options={statusOptions} onChange={(v) => { setLocalStatusFilter(v as TaskStatus | 'all' | 'open'); clearNotificationsParam() }} />
            <FilterSelect value={priorityFilter} options={priorityOptions} onChange={(v) => setPriorityFilter(v as TaskPriority | 'all')} />
            <FilterSelect value={typeFilter} options={typeOptions} onChange={(v) => setTypeFilter(v as TaskType | 'all')} />
          </div>

          <p className="text-sm text-muted-foreground">{totalCount} task{totalCount !== 1 ? 's' : ''}</p>

          <DataTable<Task>
            columns={columns}
            data={tasks}
            rowKey={(t) => t.id}
            onRowClick={(t) => {
              if (t.contact_id) navigate(`/accounts/${t.contact_id}`)
            }}
            sortField={sortField}
            sortDir={sortDir}
            onSort={setSort}
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setPage}
            emptyMessage="No tasks match your filters"
          />
        </>
      )}

      {/* Calendar view */}
      {view === 'calendar' && (
        <>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-heading">{format(currentMonth, 'MMMM yyyy')}</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="rounded-md p-1 text-muted-foreground hover:bg-page hover:text-heading">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setCurrentMonth(new Date())} className="rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-page hover:text-heading">
                Today
              </button>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="rounded-md p-1 text-muted-foreground hover:bg-page hover:text-heading">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white shadow-card overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border bg-page/50">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd')
                const dayTasks = tasksByDate.get(dateKey) ?? []
                const inMonth = isSameMonth(day, currentMonth)
                const today = isToday(day)
                return (
                  <div
                    key={dateKey}
                    onClick={() => setCreateDate(dateKey)}
                    className={`min-h-[100px] border-b border-r border-border p-1.5 cursor-pointer transition-colors hover:bg-page/30 ${!inMonth ? 'bg-page/20' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center ${today ? 'bg-primary text-white' : inMonth ? 'text-heading' : 'text-muted-foreground/50'}`}>
                        {format(day, 'd')}
                      </span>
                      {dayTasks.length > 0 && <span className="text-[9px] text-muted-foreground">{dayTasks.length}</span>}
                    </div>
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map((task) => {
                        const colors = typeColors[task.type] ?? typeColors.other
                        const contact = task.contact_id ? contactMap.get(task.contact_id) : null
                        const completed = task.status === 'completed'
                        return (
                          <button
                            key={task.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedCalTask(task) }}
                            className={`w-full rounded px-1.5 py-0.5 text-left text-[10px] truncate ${colors.bg} ${colors.text} ${completed ? 'opacity-50 line-through' : ''}`}
                          >
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${colors.dot} mr-1`} />
                            {task.title}
                            {contact && <span className="text-[9px] opacity-70"> - {contact.last_name}</span>}
                          </button>
                        )
                      })}
                      {dayTasks.length > 3 && <p className="text-[9px] text-muted-foreground pl-1">+{dayTasks.length - 3} more</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-4 text-[10px]">
            {Object.entries(typeColors).map(([type, colors]) => (
              <div key={type} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <span className="text-muted-foreground">{TASK_TYPE_LABELS[type as keyof typeof TASK_TYPE_LABELS] ?? type}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Calendar task detail popup */}
      {selectedCalTask && (() => {
        const task = selectedCalTask
        const colors = typeColors[task.type] ?? typeColors.other
        const contact = task.contact_id ? contactMap.get(task.contact_id) : null
        const completed = task.status === 'completed'
        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSelectedCalTask(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div className="w-full max-w-sm rounded-2xl bg-white shadow-modal p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                      <span className={`text-xs font-medium ${colors.text}`}>{TASK_TYPE_LABELS[task.type]}</span>
                      {completed && <span className="text-[10px] text-success font-medium">Completed</span>}
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-heading">{task.title}</h3>
                  </div>
                  <button onClick={() => setSelectedCalTask(null)} className="text-muted-foreground hover:text-heading text-lg">&times;</button>
                </div>
                {task.description && <p className="text-xs text-body mb-3">{task.description}</p>}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div>
                    <span className="text-muted-foreground">Date</span>
                    <p className="font-medium text-heading">{task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : 'No date'}</p>
                  </div>
                  {contact && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Customer</span>
                      <p className="font-medium text-heading">{contact.first_name} {contact.last_name}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {contact && (
                    <button
                      onClick={() => { setSelectedCalTask(null); navigate(`/accounts/${contact.id}`) }}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
                    >
                      Open Account
                    </button>
                  )}
                  {!completed && (
                    <button
                      onClick={async () => {
                        await completeTask(task.id)
                        setSelectedCalTask(null)
                        fetchCalendarTasks(format(gridStart, 'yyyy-MM-dd'), format(gridEnd, 'yyyy-MM-dd'))
                      }}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-heading hover:bg-page"
                    >
                      Complete
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      await deleteTask(task.id)
                      setSelectedCalTask(null)
                      fetchCalendarTasks(format(gridStart, 'yyyy-MM-dd'), format(gridEnd, 'yyyy-MM-dd'))
                    }}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-danger/70 hover:text-danger hover:border-danger/30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {/* Create modals */}
      {showCreateModal && <CreateTaskModal onClose={() => setShowCreateModal(false)} />}
      {createDate && (
        <CreateTaskModal
          onClose={() => {
            setCreateDate(null)
            fetchCalendarTasks(format(gridStart, 'yyyy-MM-dd'), format(gridEnd, 'yyyy-MM-dd'))
          }}
          prefillDueDate={createDate}
        />
      )}
    </div>
  )
}

function FilterSelect({ value, options, onChange }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-border bg-white py-2 pl-3 pr-8 text-sm text-body shadow-card outline-none focus:border-primary"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}
