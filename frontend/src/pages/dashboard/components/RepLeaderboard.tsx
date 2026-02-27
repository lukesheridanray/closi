import usePipelineStore from '@/stores/pipelineStore'
import useContactStore from '@/stores/contactStore'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export default function RepLeaderboard() {
  const deals = usePipelineStore((s) => s.deals)
  const stages = usePipelineStore((s) => s.stages)
  const activities = useContactStore((s) => s.activities)

  const wonStageIds = new Set(stages.filter((s) => s.is_won).map((s) => s.id))

  // Build rep stats
  const repStats = new Map<string, { revenue: number; dealsClosed: number; activities: number }>()
  const reps = ['Rep A', 'Rep B', 'Rep C']
  reps.forEach((rep) => repStats.set(rep, { revenue: 0, dealsClosed: 0, activities: 0 }))

  deals.forEach((deal) => {
    if (!deal.assigned_to) return
    const stat = repStats.get(deal.assigned_to)
    if (!stat) return
    if (wonStageIds.has(deal.stage_id)) {
      stat.revenue += deal.value
      stat.dealsClosed += 1
    }
  })

  activities.forEach((a) => {
    if (!a.performed_by || a.performed_by === 'System') return
    const stat = repStats.get(a.performed_by)
    if (stat) stat.activities += 1
  })

  const sorted = [...repStats.entries()].sort((a, b) => b[1].revenue - a[1].revenue)

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-card">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Rep Leaderboard
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rep</th>
            <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revenue</th>
            <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Closed</th>
            <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activities</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([rep, stats], i) => (
            <tr key={rep} className="border-b border-border/50 last:border-b-0">
              <td className="py-2.5 text-sm font-medium text-heading">
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  {i + 1}
                </span>
                {rep}
              </td>
              <td className="py-2.5 text-right text-sm font-bold text-primary">{currencyFormat.format(stats.revenue)}</td>
              <td className="py-2.5 text-right text-sm text-body">{stats.dealsClosed}</td>
              <td className="py-2.5 text-right text-sm text-body">{stats.activities}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
