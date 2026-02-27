import { AlertTriangle } from 'lucide-react'
import { differenceInDays, format } from 'date-fns'
import type { DealWithContact, PipelineStage } from '@/types/pipeline'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

interface DealTableRowProps {
  deal: DealWithContact
  allStages: PipelineStage[]
  isSelected: boolean
  onToggleSelect: (dealId: string) => void
  onClick: () => void
  onMoveDeal: (dealId: string, toStageId: string) => void
}

export default function DealTableRow({
  deal,
  allStages,
  isSelected,
  onToggleSelect,
  onClick,
  onMoveDeal,
}: DealTableRowProps) {
  const daysInStage = differenceInDays(new Date(), new Date(deal.updated_at))
  const stage = allStages.find((s) => s.id === deal.stage_id)
  const isStale = stage ? daysInStage > stage.stale_days : false

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-border/50 last:border-b-0 hover:bg-page/60 transition-colors"
    >
      {/* Checkbox */}
      <td className="px-3 py-2.5 w-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(deal.id)}
          onClick={(e) => e.stopPropagation()}
          className="accent-primary h-4 w-4 rounded"
        />
      </td>

      {/* Deal name */}
      <td className="px-3 py-2.5">
        <span className="text-sm font-medium text-heading">{deal.title}</span>
      </td>

      {/* Contact */}
      <td className="px-3 py-2.5">
        <span className="text-sm text-body">
          {deal.contact.first_name} {deal.contact.last_name}
        </span>
      </td>

      {/* Owner */}
      <td className="px-3 py-2.5">
        <span className="text-sm text-body">
          {deal.assigned_to ?? 'Unassigned'}
        </span>
      </td>

      {/* Value */}
      <td className="px-3 py-2.5 text-right">
        <span className="text-sm font-bold text-primary">
          {currencyFormat.format(deal.value)}
        </span>
      </td>

      {/* Days in stage */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          {isStale && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
          <span className={`text-sm ${isStale ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
            {daysInStage}d
          </span>
        </div>
      </td>

      {/* Expected close */}
      <td className="px-3 py-2.5">
        <span className="text-sm text-body">
          {deal.expected_close_date
            ? format(new Date(deal.expected_close_date), 'MMM d, yyyy')
            : '--'}
        </span>
      </td>

      {/* Stage dropdown */}
      <td className="px-3 py-2.5">
        <select
          value={deal.stage_id}
          onChange={(e) => onMoveDeal(deal.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="rounded border border-border bg-white px-2 py-1 text-xs text-body focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {allStages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </td>
    </tr>
  )
}
