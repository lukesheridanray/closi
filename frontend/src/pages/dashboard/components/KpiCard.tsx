import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string
  trend?: {
    value: string
    direction: 'up' | 'down' | 'neutral'
  }
  icon?: React.ReactNode
  className?: string
}

const trendConfig = {
  up: {
    icon: TrendingUp,
    className: 'text-success',
  },
  down: {
    icon: TrendingDown,
    className: 'text-danger',
  },
  neutral: {
    icon: null,
    className: 'text-muted-foreground',
  },
} as const

export default function KpiCard({
  title,
  value,
  trend,
  icon,
  className,
}: KpiCardProps) {
  const trendStyle = trend ? trendConfig[trend.direction] : null
  const TrendIcon = trendStyle?.icon ?? null

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-white p-5 shadow-card',
        className
      )}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span className="text-muted-foreground">{icon}</span>
        )}
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
      </div>

      <p className="mt-2 text-[28px] font-bold leading-tight text-heading">
        {value}
      </p>

      {trend && trendStyle && (
        <div className={cn('mt-1 flex items-center gap-1 text-xs', trendStyle.className)}>
          {TrendIcon && <TrendIcon className="h-3.5 w-3.5" />}
          <span>{trend.value}</span>
        </div>
      )}
    </div>
  )
}
