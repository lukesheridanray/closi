import { Menu, Search, Bell, HelpCircle } from 'lucide-react'
import useLayoutStore from '@/stores/layoutStore'
import usePageTitle from '@/hooks/usePageTitle'

export default function TopBar() {
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar)
  const setMobileDrawerOpen = useLayoutStore((s) => s.setMobileDrawerOpen)
  const title = usePageTitle()

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-white px-4">
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3">
        {/* Desktop toggle */}
        <button
          onClick={toggleSidebar}
          className="hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent lg:inline-flex"
          title="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="inline-flex rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent lg:hidden"
          title="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <h1 className="text-lg font-semibold text-heading">{title}</h1>
      </div>

      {/* Right: icon buttons */}
      <div className="ml-auto flex items-center gap-1">
        <button
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent"
          title="Search"
        >
          <Search className="h-5 w-5" />
        </button>
        <button
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>
        <button
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent"
          title="Help"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
