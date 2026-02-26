import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import useLayoutStore from '@/stores/layoutStore'
import { cn } from '@/lib/utils'

export default function AppLayout() {
  const collapsed = useLayoutStore((s) => s.sidebarCollapsed)

  return (
    <div className="min-h-screen bg-page">
      <Sidebar />

      <div
        className={cn(
          'flex min-h-screen flex-col transition-all duration-200 lg:ml-64',
          collapsed && 'lg:ml-16',
        )}
      >
        <TopBar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
