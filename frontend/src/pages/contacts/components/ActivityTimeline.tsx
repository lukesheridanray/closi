import { format } from 'date-fns'
import {
  FileText,
  Phone,
  Mail,
  Users,
  MapPin,
  CheckSquare,
  TrendingUp,
  ArrowRightLeft,
  Send,
} from 'lucide-react'
import type { Activity, ActivityType } from '@/types/contact'

const typeConfig: Record<ActivityType, { icon: typeof FileText; color: string }> = {
  note:         { icon: FileText,      color: 'bg-muted text-muted-foreground' },
  call:         { icon: Phone,         color: 'bg-info/10 text-info' },
  email:        { icon: Mail,          color: 'bg-primary/10 text-primary' },
  meeting:      { icon: Users,         color: 'bg-purple-100 text-purple-600' },
  site_visit:   { icon: MapPin,        color: 'bg-success/10 text-success' },
  task_created: { icon: CheckSquare,   color: 'bg-warning/10 text-warning' },
  deal_created: { icon: TrendingUp,    color: 'bg-success/10 text-success' },
  stage_change: { icon: ArrowRightLeft,color: 'bg-info/10 text-info' },
  quote_sent:   { icon: Send,          color: 'bg-warning/10 text-warning' },
}

interface ActivityTimelineProps {
  activities: Activity[]
}

export default function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No activity recorded yet
      </p>
    )
  }

  // Sort reverse chronological
  const sorted = [...activities].sort(
    (a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime(),
  )

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-4">
        {sorted.map((activity) => {
          const config = typeConfig[activity.type]
          const Icon = config.icon

          return (
            <div key={activity.id} className="relative flex gap-3 pl-0">
              {/* Icon circle */}
              <div
                className={`relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${config.color}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>

              {/* Content */}
              <div className="flex-1 pt-0.5">
                <p className="text-sm font-medium text-heading">
                  {activity.subject}
                </p>
                <p className="mt-0.5 text-xs text-body leading-relaxed">
                  {activity.description}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{format(new Date(activity.performed_at), 'MMM d, yyyy')}</span>
                  <span>&middot;</span>
                  <span>{activity.performed_by}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
