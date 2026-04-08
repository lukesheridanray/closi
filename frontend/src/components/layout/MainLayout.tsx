import { Outlet } from 'react-router-dom'
import IconNavRail from './IconNavRail'
import PageHeader from './PageHeader'
import MobileNav from './MobileNav'

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-page">
      <IconNavRail />

      <div className="flex min-h-screen flex-col md:ml-[60px]">
        <PageHeader />
        <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      <MobileNav />
    </div>
  )
}
