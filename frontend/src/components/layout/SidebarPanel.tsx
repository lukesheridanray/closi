import { ChevronDown } from 'lucide-react'
import useAuthStore from '@/stores/authStore'
import useLayoutStore from '@/stores/layoutStore'
import { cn } from '@/lib/utils'

export default function SidebarPanel() {
  const organization = useAuthStore((s) => s.organization)
  const open = useLayoutStore((s) => s.sidebarPanelOpen)

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-[60px] z-20 hidden w-[280px] border-r border-border bg-white transition-transform duration-200 xl:block',
        !open && 'xl:-translate-x-full',
      )}
    >
      <div className="flex h-full flex-col">
        {/* Org selector */}
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-heading">
              {organization?.name ?? 'My Organization'}
            </p>
            {organization?.city && organization?.state && (
              <p className="truncate text-xs text-muted-foreground">
                {organization.city}, {organization.state}
              </p>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>

        {/* Messages / activity placeholder */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent Activity
          </h3>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-border p-3"
              >
                <div className="mb-1.5 h-3 w-3/4 rounded bg-page" />
                <div className="h-2.5 w-1/2 rounded bg-page" />
              </div>
            ))}
          </div>

          {/* Overview metrics placeholder */}
          <h3 className="mb-3 mt-6 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Overview
          </h3>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-border p-3"
              >
                <div className="mb-2 h-2.5 w-1/3 rounded bg-page" />
                <div className="h-5 w-1/2 rounded bg-page" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
