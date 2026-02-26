import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, X } from 'lucide-react'
import { mainNavItems, bottomNavItems } from '@/lib/navigation'
import useAuthStore from '@/stores/authStore'
import useLayoutStore from '@/stores/layoutStore'
import { cn } from '@/lib/utils'

interface NavProps {
  collapsed: boolean
  onNavigate?: () => void
}

function NavItems({ collapsed, onNavigate }: NavProps) {
  return (
    <>
      {mainNavItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              collapsed && 'justify-center px-0',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </>
  )
}

function BottomNav({ collapsed, onNavigate }: NavProps) {
  return (
    <>
      {bottomNavItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              collapsed && 'justify-center px-0',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </>
  )
}

function UserBlock({ collapsed }: { collapsed: boolean }) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/signin')
  }

  const initials = user
    ? `${user.first_name?.[0] ?? '?'}${user.last_name?.[0] ?? '?'}`
    : '??'

  return (
    <div
      className={cn(
        'flex items-center gap-3',
        collapsed && 'justify-center',
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {initials}
      </div>
      {!collapsed && (
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-heading">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="truncate text-xs capitalize text-muted-foreground">
              {user?.role}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  )
}

export default function Sidebar() {
  const collapsed = useLayoutStore((s) => s.sidebarCollapsed)
  const mobileOpen = useLayoutStore((s) => s.mobileDrawerOpen)
  const setMobileDrawerOpen = useLayoutStore((s) => s.setMobileDrawerOpen)

  const sidebarContent = (isCollapsed: boolean, onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div
        className={cn(
          'flex h-14 items-center border-b border-sidebar-border px-4',
          isCollapsed && 'justify-center px-2',
        )}
      >
        <span className="text-xl font-bold tracking-tight text-primary">
          {isCollapsed ? 'C' : 'CLOSI'}
        </span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <NavItems collapsed={isCollapsed} onNavigate={onNavigate} />
      </nav>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="mb-3 space-y-1">
          <BottomNav collapsed={isCollapsed} onNavigate={onNavigate} />
        </div>
        <UserBlock collapsed={isCollapsed} />
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden border-r border-sidebar-border bg-sidebar transition-all duration-200 lg:block',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {sidebarContent(collapsed)}
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r border-sidebar-border bg-sidebar transition-transform duration-200 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <button
          onClick={() => setMobileDrawerOpen(false)}
          className="absolute right-3 top-4 rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
        {sidebarContent(false, () => setMobileDrawerOpen(false))}
      </aside>
    </>
  )
}
