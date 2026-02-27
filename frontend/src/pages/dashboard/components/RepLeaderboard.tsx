import { useState, useEffect } from 'react'
import { analyticsApi } from '@/lib/api'
import type { RepLeaderboardEntry } from '@/lib/api'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export default function RepLeaderboard() {
  const [reps, setReps] = useState<RepLeaderboardEntry[]>([])

  useEffect(() => {
    analyticsApi.getDashboard().then((data) => {
      setReps(data.rep_leaderboard)
    }).catch(() => {})
  }, [])

  const sorted = [...reps].sort((a, b) => b.revenue - a.revenue)

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-card">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Rep Leaderboard
      </h3>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rep data available</p>
      ) : (
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
            {sorted.map((rep, i) => (
              <tr key={rep.user_id} className="border-b border-border/50 last:border-b-0">
                <td className="py-2.5 text-sm font-medium text-heading">
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                  {rep.name}
                </td>
                <td className="py-2.5 text-right text-sm font-bold text-primary">{currencyFormat.format(rep.revenue)}</td>
                <td className="py-2.5 text-right text-sm text-body">{rep.deals_closed}</td>
                <td className="py-2.5 text-right text-sm text-body">{rep.activities}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
