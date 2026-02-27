import { differenceInDays } from 'date-fns'
import { AlertTriangle } from 'lucide-react'
import usePipelineStore from '@/stores/pipelineStore'
import { useEntityLabels } from '@/hooks/useEntityLabels'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export default function StaleDealsList() {
  const { deal: dealLabel } = useEntityLabels()
  const deals = usePipelineStore((s) => s.deals)
  const stages = usePipelineStore((s) => s.stages)
  const contacts = usePipelineStore((s) => s.contacts)

  const stageMap = new Map(stages.map((s) => [s.id, s]))
  const contactMap = new Map(contacts.map((c) => [c.id, c]))

  const staleDeals = deals
    .map((deal) => {
      const stage = stageMap.get(deal.stage_id)
      if (!stage || stage.is_won_stage || stage.is_lost_stage) return null
      const daysInStage = differenceInDays(new Date(), new Date(deal.updated_at))
      if (daysInStage <= stage.stale_days) return null
      return { deal, stage, daysInStage, contact: contactMap.get(deal.contact_id) }
    })
    .filter(Boolean)
    .sort((a, b) => b!.daysInStage - a!.daysInStage)

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-card">
      <h3 className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
        Stale {dealLabel.plural}
      </h3>
      {staleDeals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No stale {dealLabel.pluralLower}</p>
      ) : (
        <div className="space-y-2">
          {staleDeals.map((item) => {
            if (!item) return null
            return (
              <div key={item.deal.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-heading truncate">{item.deal.title}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs">
                    <span
                      className="inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: item.stage.color }}
                    >
                      {item.stage.name}
                    </span>
                    {item.contact && (
                      <span className="text-muted-foreground">{item.contact.first_name} {item.contact.last_name}</span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold text-primary">{currencyFormat.format(item.deal.estimated_value)}</p>
                  <p className="text-xs text-warning font-medium">{item.daysInStage}d in stage</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
