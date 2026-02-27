import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { mainNavItems, bottomNavItems } from '@/lib/navigation'
import useAuthStore from '@/stores/authStore'
import { cn } from '@/lib/utils'

export default function IconNavRail() {
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
    <nav className="fixed inset-y-0 left-0 z-30 hidden w-[60px] flex-col border-r border-border bg-white md:flex">
      {/* Brand icon */}
      <div className="flex h-14 items-center justify-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
          C
        </div>
      </div>

      {/* Main nav icons */}
      <div className="flex flex-1 flex-col items-center gap-2 py-2">
        {mainNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            title={item.label}
            className={({ isActive }) =>
              cn(
                'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                isActive
                  ? 'bg-primary-light text-primary'
                  : 'text-muted-foreground hover:bg-page hover:text-body',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-x-[5px] -translate-y-1/2 rounded-full bg-primary" />
                )}
                <item.icon className="h-5 w-5" />
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Bottom: settings, logout, avatar */}
      <div className="flex flex-col items-center gap-1 border-t border-border py-3">
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={item.label}
            className={({ isActive }) =>
              cn(
                'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                isActive
                  ? 'bg-primary-light text-primary'
                  : 'text-muted-foreground hover:bg-page hover:text-body',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-x-[5px] -translate-y-1/2 rounded-full bg-primary" />
                )}
                <item.icon className="h-5 w-5" />
              </>
            )}
          </NavLink>
        ))}

        <button
          onClick={handleLogout}
          title="Logout"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-page hover:text-danger"
        >
          <LogOut className="h-5 w-5" />
        </button>

        {/* User avatar with online dot */}
        <div className="relative mt-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-white">
            {initials}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white bg-success" />
        </div>
      </div>
    </nav>
  )
}
