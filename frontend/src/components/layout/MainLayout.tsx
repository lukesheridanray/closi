import { Outlet } from 'react-router-dom'
import IconNavRail from './IconNavRail'
import SidebarPanel from './SidebarPanel'
import PageHeader from './PageHeader'
import MobileNav from './MobileNav'
import useLayoutStore from '@/stores/layoutStore'
import { cn } from '@/lib/utils'

export default function MainLayout() {
  const sidebarPanelOpen = useLayoutStore((s) => s.sidebarPanelOpen)

  return (
    <div className="min-h-screen bg-page">
      {/* Icon Nav Rail - hidden on mobile, visible md+ */}
      <IconNavRail />

      {/* Sidebar Panel - visible xl+ */}
      <SidebarPanel />

      {/* Main content area */}
      <div
        className={cn(
          'flex min-h-screen flex-col transition-all duration-200',
          // md+: offset by nav rail (60px)
          'md:ml-[60px]',
          // xl+: also offset by sidebar panel (280px) when open
          sidebarPanelOpen ? 'xl:ml-[340px]' : 'xl:ml-[60px]',
        )}
      >
        <PageHeader />
        <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav - visible <md */}
      <MobileNav />
    </div>
  )
}
