import {
  LayoutDashboard,
  GitBranch,
  Users,
  CheckSquare,
  FileText,
  FileSignature,
  Receipt,
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
  { label: 'Pipeline', path: '/pipeline', icon: GitBranch },
  { label: 'Contacts', path: '/contacts', icon: Users },
  { label: 'Tasks', path: '/tasks', icon: CheckSquare },
  { label: 'Quotes', path: '/quotes', icon: FileText },
  { label: 'Contracts', path: '/contracts', icon: FileSignature },
  { label: 'Invoices', path: '/invoices', icon: Receipt },
]

export const bottomNavItems: NavItem[] = [
  { label: 'Settings', path: '/settings', icon: Settings },
]
