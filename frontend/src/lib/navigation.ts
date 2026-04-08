import {
  LayoutDashboard,
  CreditCard,
  Kanban,
  Users,
  CheckSquare,
  CalendarDays,
  FileText,
  FileSignature,
  Receipt,
  Package,
  BarChart3,
  Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}

export const mainNavItems: NavItem[] = [
  { label: 'Operations', path: '/', icon: LayoutDashboard },
  { label: 'Sales Board', path: '/pipeline', icon: Kanban },
  { label: 'Accounts', path: '/contacts', icon: Users },
  { label: 'Follow-Up', path: '/tasks', icon: CheckSquare },
  { label: 'Calendar', path: '/calendar', icon: CalendarDays },
  { label: 'Quotes', path: '/quotes', icon: FileText },
  { label: 'Agreements', path: '/contracts', icon: FileSignature },
  { label: 'Billing', path: '/billing', icon: CreditCard },
  { label: 'Invoices', path: '/invoices', icon: Receipt },
  { label: 'Inventory', path: '/inventory', icon: Package },
  { label: 'Monitoring', path: '/reports', icon: BarChart3 },
]

export const bottomNavItems: NavItem[] = [
  { label: 'Settings', path: '/settings', icon: Settings },
]
