import { useState, useEffect } from 'react'
import { ChevronDown, FileText, Phone, Mail, Users, MapPin, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import useAuthStore from '@/stores/authStore'
import useLayoutStore from '@/stores/layoutStore'
import { activitiesApi, analyticsApi } from '@/lib/api'
import type { Activity, ActivityType } from '@/types/contact'
import type { DashboardResponse } from '@/lib/api'
import { cn } from '@/lib/utils'

const activityIcons: Partial<Record<ActivityType, typeof FileText>> = {
  note: FileText,
  call: Phone,
  email: Mail,
  meeting: Users,
  site_visit: MapPin,
  deal_created: TrendingUp,
}

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export default function SidebarPanel() {
  const organization = useAuthStore((s) => s.organization)
  const open = useLayoutStore((s) => s.sidebarPanelOpen)

  const [activities, setActivities] = useState<Activity[]>([])
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)

  useEffect(() => {
    activitiesApi.list({ page_size: 5 }).then((data) => {
      setActivities(data.items)
    }).catch(() => {})

    analyticsApi.getDashboard().then(setDashboard).catch(() => {})
  }, [])

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

        {/* Recent Activity */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent Activity
          </h3>
          <div className="space-y-2">
            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent activity</p>
            ) : (
              activities.map((a) => {
                const Icon = activityIcons[a.type] ?? FileText
                return (
                  <div key={a.id} className="flex items-start gap-2.5 rounded-lg border border-border p-2.5">
                    <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-heading">{a.subject}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(a.performed_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Overview metrics */}
          <h3 className="mb-3 mt-6 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Overview
          </h3>
          <div className="space-y-2">
            {dashboard ? (
              dashboard.kpis.slice(0, 4).map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-border p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{kpi.label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-heading">
                    {typeof kpi.value === 'number' ? currencyFormat.format(kpi.value) : kpi.value}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Loading...</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
