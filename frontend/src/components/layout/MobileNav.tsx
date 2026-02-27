import { NavLink } from 'react-router-dom'
import { mainNavItems } from '@/lib/navigation'
import { cn } from '@/lib/utils'

/** Bottom navigation bar for mobile (<768px) - shows first 5 items */
const mobileItems = mainNavItems.slice(0, 5)

export default function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-white md:hidden">
      {mobileItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )
          }
        >
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
