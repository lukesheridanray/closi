import { create } from 'zustand'
import { tasksApi } from '@/lib/api'
import type { Task, TaskPriority, TaskStatus, TaskType } from '@/types/task'

// --- Types ---

export type TaskSortField = 'title' | 'priority' | 'status' | 'type' | 'due_date' | 'assigned_to'
export type TaskSortDir = 'asc' | 'desc'

const SORT_FIELD_MAP: Record<TaskSortField, string> = {
  title: 'title',
  priority: 'priority',
  status: 'status',
  type: 'type',
  due_date: 'due_date',
  assigned_to: 'assigned_to',
}

interface TaskState {
  tasks: Task[]
  selectedTaskId: string | null
  search: string
  statusFilter: TaskStatus | 'all'
  priorityFilter: TaskPriority | 'all'
  typeFilter: TaskType | 'all'
  assigneeFilter: string | 'all'
  sortField: TaskSortField
  sortDir: TaskSortDir
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  loading: boolean
  error: string | null

  // Actions
  fetchTasks: () => Promise<void>
  selectTask: (id: string | null) => void
  setSearch: (q: string) => void
  setStatusFilter: (status: TaskStatus | 'all') => void
  setPriorityFilter: (priority: TaskPriority | 'all') => void
  setTypeFilter: (type: TaskType | 'all') => void
  setAssigneeFilter: (assignee: string | 'all') => void
  setSort: (field: TaskSortField) => void
  setPage: (page: number) => void
  addTask: (task: Partial<Task>) => Promise<Task>
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>
  completeTask: (taskId: string) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  calendarTasks: Task[]
  fetchCalendarTasks: (from: string, to: string) => Promise<void>
}

// --- Store ---

const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  calendarTasks: [],
  selectedTaskId: null,
  search: '',
  statusFilter: 'all',
  priorityFilter: 'all',
  typeFilter: 'all',
  assigneeFilter: 'all',
  sortField: 'due_date',
  sortDir: 'asc',
  page: 1,
  pageSize: 10,
  totalCount: 0,
  totalPages: 1,
  loading: false,
  error: null,

  fetchTasks: async () => {
    const { search, statusFilter, priorityFilter, typeFilter, assigneeFilter, sortField, sortDir, page, pageSize } = get()
    set({ loading: true, error: null })
    try {
      const data = await tasksApi.list({
        page,
        page_size: pageSize,
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        assigned_to: assigneeFilter !== 'all' ? assigneeFilter : undefined,
        sort_by: SORT_FIELD_MAP[sortField],
        sort_dir: sortDir,
      })
      set({
        tasks: data.items,
        totalCount: data.meta.total_count,
        totalPages: data.meta.total_pages,
        loading: false,
      })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch tasks' })
    }
  },

  selectTask: (id) => set({ selectedTaskId: id }),

  setSearch: (q) => {
    set({ search: q, page: 1 })
    get().fetchTasks()
  },

  setStatusFilter: (status) => {
    set({ statusFilter: status, page: 1 })
    get().fetchTasks()
  },

  setPriorityFilter: (priority) => {
    set({ priorityFilter: priority, page: 1 })
    get().fetchTasks()
  },

  setTypeFilter: (type) => {
    set({ typeFilter: type, page: 1 })
    get().fetchTasks()
  },

  setAssigneeFilter: (assignee) => {
    set({ assigneeFilter: assignee, page: 1 })
    get().fetchTasks()
  },

  setSort: (field) => {
    const state = get()
    set({
      sortField: field,
      sortDir: state.sortField === field && state.sortDir === 'asc' ? 'desc' : 'asc',
      page: 1,
    })
    get().fetchTasks()
  },

  setPage: (page) => {
    set({ page })
    get().fetchTasks()
  },

  addTask: async (taskData) => {
    const task = await tasksApi.create(taskData)
    get().fetchTasks()
    return task
  },

  updateTask: async (taskId, updates) => {
    const updated = await tasksApi.update(taskId, updates)
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? updated : t)),
    }))
  },

  completeTask: async (taskId) => {
    const updated = await tasksApi.complete(taskId)
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? updated : t)),
    }))
  },

  deleteTask: async (taskId) => {
    await tasksApi.delete(taskId)
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    }))
  },

  fetchCalendarTasks: async (from, to) => {
    try {
      const data = await tasksApi.list({
        due_date_from: from,
        due_date_to: to,
        page_size: 100,
      })
      set({ calendarTasks: data.items })
    } catch {
      set({ calendarTasks: [] })
    }
  },
}))

// --- Selectors ---

export function useFilteredTasks() {
  const tasks = useTaskStore((s) => s.tasks)
  const totalCount = useTaskStore((s) => s.totalCount)
  const totalPages = useTaskStore((s) => s.totalPages)
  const page = useTaskStore((s) => s.page)

  return { tasks, totalCount, totalPages, page }
}

export function useTasksDueToday() {
  const tasks = useTaskStore((s) => s.tasks)
  const todayStr = new Date().toISOString().split('T')[0]
  return tasks.filter((t) =>
    t.due_date === todayStr && (t.status === 'pending' || t.status === 'in_progress'),
  )
}

export function useOverdueTasks() {
  const tasks = useTaskStore((s) => s.tasks)
  const todayStr = new Date().toISOString().split('T')[0]
  return tasks.filter((t) =>
    t.due_date && t.due_date < todayStr && (t.status === 'pending' || t.status === 'in_progress'),
  )
}

export function useTasksForContact(contactId: string) {
  const tasks = useTaskStore((s) => s.tasks)
  return tasks.filter((t) => t.contact_id === contactId)
}

export function useTasksForDeal(dealId: string) {
  const tasks = useTaskStore((s) => s.tasks)
  return tasks.filter((t) => t.deal_id === dealId)
}

export default useTaskStore
