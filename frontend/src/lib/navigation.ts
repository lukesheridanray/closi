import {
  LayoutDashboard,
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
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Pipeline', path: '/pipeline', icon: Kanban },
  { label: 'Contacts', path: '/contacts', icon: Users },
  { label: 'Tasks', path: '/tasks', icon: CheckSquare },
  { label: 'Calendar', path: '/calendar', icon: CalendarDays },
  { label: 'Quotes', path: '/quotes', icon: FileText },
  { label: 'Contracts', path: '/contracts', icon: FileSignature },
  { label: 'Invoices', path: '/invoices', icon: Receipt },
  { label: 'Inventory', path: '/inventory', icon: Package },
  { label: 'Reports', path: '/reports', icon: BarChart3 },
]

export const bottomNavItems: NavItem[] = [
  { label: 'Settings', path: '/settings', icon: Settings },
]
