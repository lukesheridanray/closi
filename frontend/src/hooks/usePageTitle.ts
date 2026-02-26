import { useLocation } from 'react-router-dom'
import { mainNavItems, bottomNavItems } from '@/lib/navigation'

const allNavItems = [...mainNavItems, ...bottomNavItems]

export default function usePageTitle(): string {
  const { pathname } = useLocation()

  const match = allNavItems.find((item) =>
    item.path === '/' ? pathname === '/' : pathname.startsWith(item.path),
  )

  return match?.label ?? 'Dashboard'
}
