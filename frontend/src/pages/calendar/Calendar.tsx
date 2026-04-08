import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isToday, isSameDay,
  addMonths, subMonths,
} from 'date-fns'
import useTaskStore from '@/stores/taskStore'
import useContactStore from '@/stores/contactStore'
import type { Task } from '@/types/task'
import { TASK_TYPE_LABELS } from '@/types/task'
import CreateTaskModal from '@/pages/tasks/components/CreateTaskModal'

const typeColors: Record<string, { bg: string; text: string; dot: string }> = {
  site_visit: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  install:    { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  call:       { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  follow_up:  { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  meeting:    { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  email:      { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  other:      { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' },
}

export default function Calendar() {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [createDate, setCreateDate] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const calendarTasks = useTaskStore((s) => s.calendarTasks)
  const fetchCalendarTasks = useTaskStore((s) => s.fetchCalendarTasks)
  const completeTask = useTaskStore((s) => s.completeTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const contacts = useContactStore((s) => s.contacts)
  const selectContact = useContactStore((s) => s.selectContact)

  const contactMap = useMemo(() => {
    const m = new Map<string, typeof contacts[0]>()
    contacts.forEach((c) => m.set(c.id, c))
    return m
  }, [contacts])

  // Compute calendar grid dates
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  // Fetch tasks for visible range
  useEffect(() => {
    fetchCalendarTasks(
      format(gridStart, 'yyyy-MM-dd'),
      format(gridEnd, 'yyyy-MM-dd'),
    )
  }, [currentMonth, fetchCalendarTasks])

  // Group tasks by date
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

  function handleTaskClick(task: Task) {
    setSelectedTask(task)
  }

  function goToAccount(contactId: string) {
    selectContact(contactId)
    navigate('/contacts')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-heading">
            {format(currentMonth, 'MMMM yyyy')}
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="rounded-md p-1 text-muted-foreground hover:bg-page hover:text-heading"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-page hover:text-heading"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="rounded-md p-1 text-muted-foreground hover:bg-page hover:text-heading"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <button
          onClick={() => setCreateDate(format(new Date(), 'yyyy-MM-dd'))}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          New Task
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-border bg-white shadow-card overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border bg-page/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
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
                className={`min-h-[100px] border-b border-r border-border p-1.5 cursor-pointer transition-colors hover:bg-page/30 ${
                  !inMonth ? 'bg-page/20' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center ${
                    today ? 'bg-primary text-white' : inMonth ? 'text-heading' : 'text-muted-foreground/50'
                  }`}>
                    {format(day, 'd')}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-[9px] text-muted-foreground">{dayTasks.length}</span>
                  )}
                </div>

                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map((task) => {
                    const colors = typeColors[task.type] ?? typeColors.other
                    const contact = task.contact_id ? contactMap.get(task.contact_id) : null
                    const completed = task.status === 'completed'

                    return (
                      <button
                        key={task.id}
                        onClick={(e) => { e.stopPropagation(); handleTaskClick(task) }}
                        className={`w-full rounded px-1.5 py-0.5 text-left text-[10px] truncate ${colors.bg} ${colors.text} ${
                          completed ? 'opacity-50 line-through' : ''
                        }`}
                      >
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${colors.dot} mr-1`} />
                        {task.due_time ? format(new Date(`2000-01-01T${task.due_time}`), 'h:mma') + ' ' : ''}
                        {task.title}
                        {contact && <span className="text-[9px] opacity-70"> - {contact.last_name}</span>}
                      </button>
                    )
                  })}
                  {dayTasks.length > 3 && (
                    <p className="text-[9px] text-muted-foreground pl-1">+{dayTasks.length - 3} more</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px]">
        {Object.entries(typeColors).map(([type, colors]) => (
          <div key={type} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
            <span className="text-muted-foreground">{TASK_TYPE_LABELS[type as keyof typeof TASK_TYPE_LABELS] ?? type}</span>
          </div>
        ))}
      </div>

      {/* Task detail popup */}
      {selectedTask && (() => {
        const task = selectedTask
        const colors = typeColors[task.type] ?? typeColors.other
        const contact = task.contact_id ? contactMap.get(task.contact_id) : null
        const completed = task.status === 'completed'

        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSelectedTask(null)} />
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
                  <button onClick={() => setSelectedTask(null)} className="text-muted-foreground hover:text-heading text-lg">&times;</button>
                </div>

                {task.description && (
                  <p className="text-xs text-body mb-3">{task.description}</p>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div>
                    <span className="text-muted-foreground">Date</span>
                    <p className="font-medium text-heading">{task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : 'No date'}</p>
                  </div>
                  {task.due_time && (
                    <div>
                      <span className="text-muted-foreground">Time</span>
                      <p className="font-medium text-heading">{format(new Date(`2000-01-01T${task.due_time}`), 'h:mm a')}</p>
                    </div>
                  )}
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
                      onClick={() => { setSelectedTask(null); goToAccount(contact.id) }}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
                    >
                      Open Account
                    </button>
                  )}
                  {!completed && (
                    <button
                      onClick={async () => {
                        await completeTask(task.id)
                        setSelectedTask(null)
                        fetchCalendarTasks(format(gridStart, 'yyyy-MM-dd'), format(gridEnd, 'yyyy-MM-dd'))
                      }}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-heading hover:bg-page"
                    >
                      Mark Complete
                    </button>
                  )}
                  <button
                    onClick={() => { setSelectedTask(null); setCreateDate(task.due_date?.split('T')[0] ?? format(new Date(), 'yyyy-MM-dd')) }}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-heading hover:bg-page"
                  >
                    Reschedule
                  </button>
                  <button
                    onClick={async () => {
                      await deleteTask(task.id)
                      setSelectedTask(null)
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

      {/* Create task modal */}
      {createDate && (
        <CreateTaskModal
          onClose={() => {
            setCreateDate(null)
            fetchCalendarTasks(
              format(gridStart, 'yyyy-MM-dd'),
              format(gridEnd, 'yyyy-MM-dd'),
            )
          }}
          prefillDueDate={createDate}
        />
      )}
    </div>
  )
}
