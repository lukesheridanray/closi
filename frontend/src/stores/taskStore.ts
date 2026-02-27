import { create } from 'zustand'
import type { Task, TaskPriority, TaskStatus, TaskType } from '@/types/task'
import useContactStore from './contactStore'

// --- Types ---

export type TaskSortField = 'title' | 'priority' | 'status' | 'type' | 'due_date' | 'assigned_to'
export type TaskSortDir = 'asc' | 'desc'

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

  // Actions
  selectTask: (id: string | null) => void
  setSearch: (q: string) => void
  setStatusFilter: (status: TaskStatus | 'all') => void
  setPriorityFilter: (priority: TaskPriority | 'all') => void
  setTypeFilter: (type: TaskType | 'all') => void
  setAssigneeFilter: (assignee: string | 'all') => void
  setSort: (field: TaskSortField) => void
  setPage: (page: number) => void
  addTask: (task: Omit<Task, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'completed_at' | 'completed_by'>) => void
  updateTask: (taskId: string, updates: Partial<Task>) => void
  completeTask: (taskId: string) => void
  deleteTask: (taskId: string) => void
}

// --- Helpers ---

const ORG_ID = 'org_01'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

// --- Mock Tasks (15) ---

const mockTasks: Task[] = [
  // Pending - due today
  { id: 'task_01', org_id: ORG_ID, contact_id: 'contact_02', deal_id: 'deal_02', assigned_to: 'Rep B', created_by: 'Rep B', title: 'Follow up with Maria Garcia', description: 'Call to discuss alarm upgrade options and schedule site visit.', priority: 'high', status: 'pending', type: 'call', due_date: today(), due_time: '10:00', duration_minutes: 30, is_all_day: false, recurrence: null, completed_at: null, completed_by: null, created_at: daysAgo(3), updated_at: daysAgo(3) },
  { id: 'task_02', org_id: ORG_ID, contact_id: 'contact_11', deal_id: null, assigned_to: 'Rep B', created_by: 'System', title: 'Call Kevin Patel - new lead', description: 'Google Ads lead. Medical office security inquiry. First contact.', priority: 'urgent', status: 'pending', type: 'call', due_date: today(), due_time: '14:00', duration_minutes: 15, is_all_day: false, recurrence: null, completed_at: null, completed_by: null, created_at: daysAgo(5), updated_at: daysAgo(5) },

  // Pending - due soon
  { id: 'task_03', org_id: ORG_ID, contact_id: 'contact_05', deal_id: 'deal_05', assigned_to: 'Rep A', created_by: 'Rep A', title: 'Schedule remaining site visits for Johnson', description: 'Need to coordinate visits to 2nd and 3rd locations. Check availability.', priority: 'medium', status: 'pending', type: 'site_visit', due_date: daysFromNow(1), due_time: null, duration_minutes: 120, is_all_day: true, recurrence: null, completed_at: null, completed_by: null, created_at: daysAgo(10), updated_at: daysAgo(10) },
  { id: 'task_04', org_id: ORG_ID, contact_id: 'contact_07', deal_id: 'deal_07', assigned_to: 'Rep C', created_by: 'Rep C', title: 'Send updated quote to Martinez', description: 'Revised pricing for 24/7 monitoring package. Include volume discount.', priority: 'high', status: 'pending', type: 'email', due_date: daysFromNow(2), due_time: null, duration_minutes: 30, is_all_day: true, recurrence: null, completed_at: null, completed_by: null, created_at: daysAgo(2), updated_at: daysAgo(2) },
  { id: 'task_05', org_id: ORG_ID, contact_id: 'contact_12', deal_id: null, assigned_to: 'Rep C', created_by: 'System', title: 'Initial consultation with Rachel Kim', description: 'New Google Ads lead. Apartment complex, wants smart lock + camera.', priority: 'medium', status: 'pending', type: 'meeting', due_date: daysFromNow(3), due_time: '09:30', duration_minutes: 60, is_all_day: false, recurrence: null, completed_at: null, completed_by: null, created_at: daysAgo(3), updated_at: daysAgo(3) },

  // In progress
  { id: 'task_06', org_id: ORG_ID, contact_id: 'contact_03', deal_id: 'deal_03', assigned_to: 'Rep A', created_by: 'Rep A', title: 'Verify SOC2 compliance for TechCorp', description: 'Check if our access control system meets SOC2 requirements for logging.', priority: 'high', status: 'in_progress', type: 'other', due_date: daysFromNow(2), due_time: null, duration_minutes: 60, is_all_day: true, recurrence: null, completed_at: null, completed_by: null, created_at: daysAgo(5), updated_at: daysAgo(1) },
  { id: 'task_07', org_id: ORG_ID, contact_id: 'contact_10', deal_id: 'deal_10', assigned_to: 'Rep A', created_by: 'Rep A', title: 'Prepare install kit for Anderson', description: 'Full package: alarm panel, 4 cameras, smart locks, motion sensors. Load truck.', priority: 'medium', status: 'in_progress', type: 'install', due_date: daysFromNow(1), due_time: '08:00', duration_minutes: 240, is_all_day: false, recurrence: null, completed_at: null, completed_by: null, created_at: daysAgo(3), updated_at: daysAgo(1) },

  // Overdue
  { id: 'task_08', org_id: ORG_ID, contact_id: 'contact_09', deal_id: 'deal_09', assigned_to: 'Rep B', created_by: 'Rep B', title: 'Follow up on Brown construction quote', description: 'Been in negotiation for a week. Need to push for decision.', priority: 'high', status: 'pending', type: 'follow_up', due_date: daysFromNow(-2), due_time: null, duration_minutes: 20, is_all_day: true, recurrence: null, completed_at: null, completed_by: null, created_at: daysAgo(7), updated_at: daysAgo(7) },
  { id: 'task_09', org_id: ORG_ID, contact_id: 'contact_06', deal_id: 'deal_06', assigned_to: 'Rep B', created_by: 'Rep B', title: 'Send camera specs to Emily Davis', description: 'She requested detailed specs for the outdoor night vision cameras.', priority: 'medium', status: 'pending', type: 'email', due_date: daysFromNow(-1), due_time: null, duration_minutes: 15, is_all_day: true, recurrence: null, completed_at: null, completed_by: null, created_at: daysAgo(4), updated_at: daysAgo(4) },
  { id: 'task_10', org_id: ORG_ID, contact_id: 'contact_13', deal_id: null, assigned_to: 'Rep A', created_by: 'Rep A', title: 'Check on Wright Auto install timeline', description: 'Auto dealership exterior cameras. Need to confirm install date.', priority: 'low', status: 'pending', type: 'call', due_date: daysFromNow(-3), due_time: null, duration_minutes: 15, is_all_day: true, recurrence: null, completed_at: null, completed_by: null, created_at: daysAgo(10), updated_at: daysAgo(10) },

  // Completed
  { id: 'task_11', org_id: ORG_ID, contact_id: 'contact_01', deal_id: 'deal_01', assigned_to: 'Rep A', created_by: 'Rep A', title: 'Site assessment at Wilson residence', description: 'Assess property for camera and sensor placement.', priority: 'high', status: 'completed', type: 'site_visit', due_date: daysFromNow(-15), due_time: '09:00', duration_minutes: 90, is_all_day: false, recurrence: null, completed_at: daysAgo(15), completed_by: 'Rep A', created_at: daysAgo(20), updated_at: daysAgo(15) },
  { id: 'task_12', org_id: ORG_ID, contact_id: 'contact_01', deal_id: 'deal_11', assigned_to: 'Rep A', created_by: 'Rep A', title: 'Send monitoring contract to Wilson', description: 'Draft and send 36-month monitoring agreement.', priority: 'medium', status: 'completed', type: 'email', due_date: daysFromNow(-10), due_time: null, duration_minutes: 30, is_all_day: true, recurrence: null, completed_at: daysAgo(10), completed_by: 'Rep A', created_at: daysAgo(12), updated_at: daysAgo(10) },
  { id: 'task_13', org_id: ORG_ID, contact_id: 'contact_14', deal_id: null, assigned_to: 'Rep B', created_by: 'Rep B', title: 'Monthly check-in with Amanda Foster', description: 'Routine customer satisfaction call.', priority: 'low', status: 'completed', type: 'call', due_date: daysFromNow(-5), due_time: '14:00', duration_minutes: 15, is_all_day: false, recurrence: 'monthly', completed_at: daysAgo(5), completed_by: 'Rep B', created_at: daysAgo(8), updated_at: daysAgo(5) },

  // Cancelled
  { id: 'task_14', org_id: ORG_ID, contact_id: 'contact_04', deal_id: null, assigned_to: 'Rep C', created_by: 'Rep C', title: 'Follow up with Sarah Thompson', description: 'She chose a competitor. No longer relevant.', priority: 'medium', status: 'cancelled', type: 'follow_up', due_date: daysFromNow(-8), due_time: null, duration_minutes: 20, is_all_day: true, recurrence: null, completed_at: null, completed_by: null, created_at: daysAgo(12), updated_at: daysAgo(8) },

  // Pending - future
  { id: 'task_15', org_id: ORG_ID, contact_id: 'contact_08', deal_id: 'deal_08', assigned_to: 'Rep A', created_by: 'Rep A', title: 'Schedule condo install for Jennifer Lee', description: 'Basic alarm + doorbell camera. Coordinate with building management for access.', priority: 'low', status: 'pending', type: 'install', due_date: daysFromNow(7), due_time: null, duration_minutes: 180, is_all_day: true, recurrence: null, completed_at: null, completed_by: null, created_at: daysAgo(1), updated_at: daysAgo(1) },
]

// --- Store ---

const useTaskStore = create<TaskState>((set, get) => ({
  tasks: mockTasks,
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

  selectTask: (id) => set({ selectedTaskId: id }),

  setSearch: (q) => set({ search: q, page: 1 }),

  setStatusFilter: (status) => set({ statusFilter: status, page: 1 }),

  setPriorityFilter: (priority) => set({ priorityFilter: priority, page: 1 }),

  setTypeFilter: (type) => set({ typeFilter: type, page: 1 }),

  setAssigneeFilter: (assignee) => set({ assigneeFilter: assignee, page: 1 }),

  setSort: (field) =>
    set((state) => ({
      sortField: field,
      sortDir: state.sortField === field && state.sortDir === 'asc' ? 'desc' : 'asc',
      page: 1,
    })),

  setPage: (page) => set({ page }),

  addTask: (taskData) =>
    set((state) => {
      const now = new Date().toISOString()
      const newTask: Task = {
        ...taskData,
        id: `task_${Date.now()}`,
        org_id: ORG_ID,
        completed_at: null,
        completed_by: null,
        created_at: now,
        updated_at: now,
      }

      // Log activity on contact timeline if linked to a contact
      if (newTask.contact_id) {
        useContactStore.getState().addActivity({
          contact_id: newTask.contact_id,
          deal_id: newTask.deal_id,
          type: 'task_created',
          subject: `Task created: ${newTask.title}`,
          description: newTask.description || `${newTask.type} task assigned to ${newTask.assigned_to ?? 'Unassigned'}`,
          performed_by: newTask.created_by,
          performed_at: now,
        })
      }

      return { tasks: [newTask, ...state.tasks] }
    }),

  updateTask: (taskId, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates, updated_at: new Date().toISOString() } : t,
      ),
    })),

  completeTask: (taskId) =>
    set((state) => {
      const task = state.tasks.find((t) => t.id === taskId)
      if (!task) return state

      const now = new Date().toISOString()

      // Log completion activity on contact timeline
      if (task.contact_id) {
        useContactStore.getState().addActivity({
          contact_id: task.contact_id,
          deal_id: task.deal_id,
          type: 'task_completed',
          subject: `Task completed: ${task.title}`,
          description: task.description || `${task.type} task completed by ${task.assigned_to ?? 'Unknown'}`,
          performed_by: task.assigned_to ?? 'You',
          performed_at: now,
        })
      }

      return {
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? { ...t, status: 'completed' as const, completed_at: now, completed_by: t.assigned_to ?? 'You', updated_at: now }
            : t,
        ),
      }
    }),

  deleteTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    })),
}))

// --- Selectors ---

const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export function useFilteredTasks() {
  const tasks = useTaskStore((s) => s.tasks)
  const search = useTaskStore((s) => s.search)
  const statusFilter = useTaskStore((s) => s.statusFilter)
  const priorityFilter = useTaskStore((s) => s.priorityFilter)
  const typeFilter = useTaskStore((s) => s.typeFilter)
  const assigneeFilter = useTaskStore((s) => s.assigneeFilter)
  const sortField = useTaskStore((s) => s.sortField)
  const sortDir = useTaskStore((s) => s.sortDir)
  const page = useTaskStore((s) => s.page)
  const pageSize = useTaskStore((s) => s.pageSize)

  const q = search.toLowerCase()

  let filtered = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    if (typeFilter !== 'all' && t.type !== typeFilter) return false
    if (assigneeFilter !== 'all' && t.assigned_to !== assigneeFilter) return false
    if (q) {
      const matchesSearch =
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      if (!matchesSearch) return false
    }
    return true
  })

  // Sort
  filtered = [...filtered].sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case 'title':
        cmp = a.title.localeCompare(b.title)
        break
      case 'priority':
        cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        break
      case 'status':
        cmp = a.status.localeCompare(b.status)
        break
      case 'type':
        cmp = a.type.localeCompare(b.type)
        break
      case 'due_date':
        cmp = a.due_date.localeCompare(b.due_date)
        break
      case 'assigned_to':
        cmp = (a.assigned_to ?? '').localeCompare(b.assigned_to ?? '')
        break
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const totalCount = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  return { tasks: paginated, totalCount, totalPages, page }
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
    t.due_date < todayStr && (t.status === 'pending' || t.status === 'in_progress'),
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
