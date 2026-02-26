export const APP_NAME = 'CLOSI'

export const PIPELINE_COLORS = {
  new_lead: '#6C63FF',
  contacted: '#3B82F6',
  consultation_scheduled: '#8B5CF6',
  quote_sent: '#F59E0B',
  negotiation: '#F97316',
  install_scheduled: '#22C55E',
  installed: '#14B8A6',
  contract_signed: '#10B981',
  lost: '#EF4444',
} as const

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  SALES_REP: 'sales_rep',
  TECHNICIAN: 'technician',
} as const

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const
export const TASK_TYPES = ['call', 'email', 'meeting', 'site_visit', 'install', 'follow_up', 'other'] as const
