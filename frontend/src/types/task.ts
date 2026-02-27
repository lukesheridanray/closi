export interface Task {
  id: string
  org_id: string
  contact_id: string | null
  deal_id: string | null
  assigned_to: string | null
  created_by: string
  title: string
  description: string
  priority: TaskPriority
  status: TaskStatus
  type: TaskType
  due_date: string
  due_time: string | null
  duration_minutes: number
  is_all_day: boolean
  recurrence: TaskRecurrence | null
  completed_at: string | null
  completed_by: string | null
  created_at: string
  updated_at: string
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type TaskType = 'call' | 'email' | 'meeting' | 'site_visit' | 'install' | 'follow_up' | 'other'
export type TaskRecurrence = 'daily' | 'weekly' | 'monthly' | 'none'

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  site_visit: 'Site Visit',
  install: 'Install',
  follow_up: 'Follow Up',
  other: 'Other',
}

export const TASK_RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  none: 'None',
}
