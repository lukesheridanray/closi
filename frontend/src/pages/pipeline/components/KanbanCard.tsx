import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlertTriangle } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import type { DealWithContact, PipelineStage } from '@/types/pipeline'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

interface KanbanCardProps {
  deal: DealWithContact
  stage: PipelineStage
  onClick: () => void
}

export default function KanbanCard({ deal, stage, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const daysInStage = differenceInDays(new Date(), new Date(deal.updated_at))
  const isStale = daysInStage > stage.stale_days

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation()
          onClick()
        }
      }}
      className={`cursor-grab rounded-lg border border-border bg-white p-3 shadow-card transition-shadow hover:shadow-card-hover active:cursor-grabbing ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <p className="text-sm font-semibold text-heading truncate">
        {deal.contact.first_name} {deal.contact.last_name}
      </p>
      <p className="text-xs text-muted-foreground truncate mt-0.5">
        {deal.title}
      </p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-bold text-primary">
          {currencyFormat.format(deal.estimated_value)}
        </span>
        <div className="flex items-center gap-1">
          {isStale && (
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          )}
          <span className={`text-xs ${isStale ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
            {daysInStage}d
          </span>
        </div>
      </div>
    </div>
  )
}

/** Render-only version for DragOverlay (no sortable hooks) */
export function KanbanCardOverlay({ deal, stage }: { deal: DealWithContact; stage: PipelineStage }) {
  const daysInStage = differenceInDays(new Date(), new Date(deal.updated_at))
  const isStale = daysInStage > stage.stale_days

  return (
    <div className="w-[264px] rotate-2 cursor-grabbing rounded-lg border border-primary/30 bg-white p-3 shadow-modal">
      <p className="text-sm font-semibold text-heading truncate">
        {deal.contact.first_name} {deal.contact.last_name}
      </p>
      <p className="text-xs text-muted-foreground truncate mt-0.5">
        {deal.title}
      </p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-bold text-primary">
          {currencyFormat.format(deal.estimated_value)}
        </span>
        <div className="flex items-center gap-1">
          {isStale && (
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          )}
          <span className={`text-xs ${isStale ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
            {daysInStage}d
          </span>
        </div>
      </div>
    </div>
  )
}
