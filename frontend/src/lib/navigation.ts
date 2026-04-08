import {
  LayoutDashboard,
  CreditCard,
  Users,
  CalendarCheck,
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
  { label: 'Accounts', path: '/accounts', icon: Users },
  { label: 'Billing', path: '/billing', icon: CreditCard },
  { label: 'Tasks', path: '/tasks', icon: CalendarCheck },
]

export const bottomNavItems: NavItem[] = [
  { label: 'Settings', path: '/settings', icon: Settings },
]
