import { useState, useEffect } from 'react'
import { format, isPast, isToday } from 'date-fns'
import { Search, Plus, ChevronDown, CheckCircle2, AlertTriangle, Flag } from 'lucide-react'
import useTaskStore, { useFilteredTasks } from '@/stores/taskStore'
import useContactStore from '@/stores/contactStore'
import type { Task, TaskStatus, TaskPriority, TaskType } from '@/types/task'
import {
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_TYPE_LABELS,
} from '@/types/task'
import DataTable, { type Column } from '@/components/shared/DataTable'
import SlideOutPanel from '@/components/layout/SlideOutPanel'
import TaskDetailPanel from './components/TaskDetailPanel'
import CreateTaskModal from './components/CreateTaskModal'

const statusOptions: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  ...Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({
    value: value as TaskStatus,
    label,
  })),
]

const priorityOptions: { value: TaskPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'All Priorities' },
  ...Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => ({
    value: value as TaskPriority,
    label,
  })),
]

const typeOptions: { value: TaskType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  ...Object.entries(TASK_TYPE_LABELS).map(([value, label]) => ({
    value: value as TaskType,
    label,
  })),
]

const assigneeOptions = [
  { value: 'all', label: 'All Assignees' },
  { value: 'Rep A', label: 'Rep A' },
  { value: 'Rep B', label: 'Rep B' },
  { value: 'Rep C', label: 'Rep C' },
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

export default function TaskList() {
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId)
  const allTasks = useTaskStore((s) => s.tasks)
  const loading = useTaskStore((s) => s.loading)
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const search = useTaskStore((s) => s.search)

  useEffect(() => { fetchTasks() }, [fetchTasks])
  const statusFilter = useTaskStore((s) => s.statusFilter)
  const priorityFilter = useTaskStore((s) => s.priorityFilter)
  const typeFilter = useTaskStore((s) => s.typeFilter)
  const assigneeFilter = useTaskStore((s) => s.assigneeFilter)
  const sortField = useTaskStore((s) => s.sortField)
  const sortDir = useTaskStore((s) => s.sortDir)
  const selectTask = useTaskStore((s) => s.selectTask)
  const completeTask = useTaskStore((s) => s.completeTask)
  const setSearch = useTaskStore((s) => s.setSearch)
  const setStatusFilter = useTaskStore((s) => s.setStatusFilter)
  const setPriorityFilter = useTaskStore((s) => s.setPriorityFilter)
  const setTypeFilter = useTaskStore((s) => s.setTypeFilter)
  const setAssigneeFilter = useTaskStore((s) => s.setAssigneeFilter)
  const setSort = useTaskStore((s) => s.setSort)
  const setPage = useTaskStore((s) => s.setPage)

  const contacts = useContactStore((s) => s.contacts)
  const fetchContacts = useContactStore((s) => s.fetchContacts)

  useEffect(() => { fetchContacts() }, [fetchContacts])

  const { tasks, totalCount, totalPages, page } = useFilteredTasks()

  const [showCreateModal, setShowCreateModal] = useState(false)

  const selectedTask = selectedTaskId
    ? allTasks.find((t) => t.id === selectedTaskId)
    : null

  // Build contact lookup map
  const contactMap = new Map(contacts.map((c) => [c.id, c]))

  const columns: Column<Task>[] = [
    {
      key: 'title',
      label: 'Task',
      sortable: true,
      render: (t) => {
        const dueDate = new Date(t.due_date)
        const isOverdue = t.status !== 'completed' && t.status !== 'cancelled' && isPast(dueDate) && !isToday(dueDate)
        return (
          <div className="flex items-center gap-2">
            {/* Complete button */}
            {(t.status === 'pending' || t.status === 'in_progress') && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  completeTask(t.id)
                }}
                className="flex-shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-success"
                title="Complete task"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
            {t.status === 'completed' && (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success" />
            )}
            <div>
              <p className={`font-medium ${t.status === 'completed' ? 'text-muted-foreground line-through' : 'text-heading'}`}>
                {t.title}
              </p>
              {isOverdue && (
                <span className="inline-flex items-center gap-0.5 text-xs text-danger">
                  <AlertTriangle className="h-3 w-3" />
                  Overdue
                </span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      className: 'hidden md:table-cell',
      render: (t) => (
        <span className="text-body">{TASK_TYPE_LABELS[t.type]}</span>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (t) => (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[t.priority]}`}>
          <Flag className="h-3 w-3" />
          {TASK_PRIORITY_LABELS[t.priority]}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      className: 'hidden md:table-cell',
      render: (t) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[t.status]}`}>
          {TASK_STATUS_LABELS[t.status]}
        </span>
      ),
    },
    {
      key: 'assigned_to',
      label: 'Assignee',
      sortable: true,
      className: 'hidden lg:table-cell',
      render: (t) => (
        <span className="text-body">{t.assigned_to ?? 'Unassigned'}</span>
      ),
    },
    {
      key: 'contact',
      label: 'Contact',
      className: 'hidden lg:table-cell',
      render: (t) => {
        if (!t.contact_id) return <span className="text-muted-foreground">--</span>
        const contact = contactMap.get(t.contact_id)
        return contact
          ? <span className="text-body">{contact.first_name} {contact.last_name}</span>
          : <span className="text-muted-foreground">--</span>
      },
    },
    {
      key: 'due_date',
      label: 'Due Date',
      sortable: true,
      render: (t) => {
        const dueDate = new Date(t.due_date)
        const isOverdue = t.status !== 'completed' && t.status !== 'cancelled' && isPast(dueDate) && !isToday(dueDate)
        const isDueToday = isToday(dueDate)
        return (
          <span className={`text-sm ${isOverdue ? 'text-danger font-medium' : isDueToday ? 'text-warning font-medium' : 'text-body'}`}>
            {isDueToday ? 'Today' : format(dueDate, 'MMM d, yyyy')}
          </span>
        )
      },
    },
  ]

  if (loading && allTasks.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading tasks...</div>
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        {/* Search */}
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

        {/* Status filter */}
        <FilterSelect
          value={statusFilter}
          options={statusOptions}
          onChange={(v) => setStatusFilter(v as TaskStatus | 'all')}
        />

        {/* Priority filter */}
        <FilterSelect
          value={priorityFilter}
          options={priorityOptions}
          onChange={(v) => setPriorityFilter(v as TaskPriority | 'all')}
        />

        {/* Type filter */}
        <FilterSelect
          value={typeFilter}
          options={typeOptions}
          onChange={(v) => setTypeFilter(v as TaskType | 'all')}
        />

        {/* Assignee filter */}
        <FilterSelect
          value={assigneeFilter}
          options={assigneeOptions}
          onChange={(v) => setAssigneeFilter(v)}
        />

        {/* Add task button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-card transition-colors hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          Add Task
        </button>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        {totalCount} task{totalCount !== 1 ? 's' : ''}
      </p>

      {/* Table */}
      <DataTable<Task>
        columns={columns}
        data={tasks}
        rowKey={(t) => t.id}
        onRowClick={(t) => selectTask(t.id)}
        sortField={sortField}
        sortDir={sortDir}
        onSort={setSort}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
        emptyMessage="No tasks match your filters"
      />

      {/* Detail slide-out */}
      <SlideOutPanel
        open={!!selectedTask}
        onClose={() => selectTask(null)}
        title={selectedTask?.title ?? 'Task Details'}
        width="md"
      >
        {selectedTask && <TaskDetailPanel task={selectedTask} />}
      </SlideOutPanel>

      {/* Create modal */}
      {showCreateModal && (
        <CreateTaskModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  )
}

function FilterSelect({
  value,
  options,
  onChange,
}: {
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
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}
