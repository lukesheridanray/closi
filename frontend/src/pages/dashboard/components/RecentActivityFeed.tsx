import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { FileText, Phone, Mail, Users, MapPin, CheckSquare, CircleCheckBig, TrendingUp, ArrowRightLeft, Send } from 'lucide-react'
import { activitiesApi } from '@/lib/api'
import useContactStore from '@/stores/contactStore'
import type { Activity, ActivityType } from '@/types/contact'

const typeConfig: Record<ActivityType, { icon: typeof FileText; color: string }> = {
  note:           { icon: FileText,       color: 'bg-muted text-muted-foreground' },
  call:           { icon: Phone,          color: 'bg-info/10 text-info' },
  email:          { icon: Mail,           color: 'bg-primary/10 text-primary' },
  meeting:        { icon: Users,          color: 'bg-purple-100 text-purple-600' },
  site_visit:     { icon: MapPin,         color: 'bg-success/10 text-success' },
  task_created:   { icon: CheckSquare,    color: 'bg-warning/10 text-warning' },
  task_completed: { icon: CircleCheckBig, color: 'bg-success/10 text-success' },
  deal_created:   { icon: TrendingUp,     color: 'bg-success/10 text-success' },
  stage_change:   { icon: ArrowRightLeft, color: 'bg-info/10 text-info' },
  quote_sent:     { icon: Send,           color: 'bg-warning/10 text-warning' },
}

export default function RecentActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([])
  const contacts = useContactStore((s) => s.contacts)
  const contactMap = new Map(contacts.map((c) => [c.id, c]))

  useEffect(() => {
    activitiesApi.list({ page_size: 8 }).then((data) => {
      setActivities(data.items)
    }).catch(() => {})
  }, [])

  const recent = [...activities]
    .sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime())

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-card">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Recent Activity
      </h3>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent activity</p>
      ) : (
        <div className="space-y-3">
          {recent.map((activity) => {
            const config = typeConfig[activity.type]
            const Icon = config.icon
            const contact = contactMap.get(activity.contact_id)
            return (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${config.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-heading truncate">{activity.subject}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {contact && <span>{contact.first_name} {contact.last_name}</span>}
                    <span>{format(new Date(activity.performed_at), 'MMM d')}</span>
                    {activity.performed_by && <span>{activity.performed_by}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
