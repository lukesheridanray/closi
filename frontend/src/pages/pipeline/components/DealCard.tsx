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

interface DealCardProps {
  deal: DealWithContact
  stage: PipelineStage
  onClick: () => void
}

export default function DealCard({ deal, stage, onClick }: DealCardProps) {
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
        // Only open panel if this wasn't a drag
        if (!isDragging) {
          e.stopPropagation()
          onClick()
        }
      }}
      className={`cursor-grab rounded-lg border border-border bg-white shadow-card transition-shadow hover:shadow-card-hover active:cursor-grabbing ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {/* Colored top bar */}
      <div
        className="h-[3px] rounded-t-lg"
        style={{ backgroundColor: stage.color }}
      />

      <div className="px-3 py-2.5">
        {/* Contact name */}
        <p className="text-sm font-semibold text-heading">
          {deal.contact.first_name} {deal.contact.last_name}
        </p>

        {/* Deal title */}
        <p className="mt-0.5 text-xs text-muted-foreground truncate">
          {deal.title}
        </p>

        {/* Value + days row */}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-lg font-bold text-primary">
            {currencyFormat.format(deal.value)}
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
    </div>
  )
}

/** Render-only version for DragOverlay (no sortable hooks) */
export function DealCardOverlay({ deal, stage }: { deal: DealWithContact; stage: PipelineStage }) {
  const daysInStage = differenceInDays(new Date(), new Date(deal.updated_at))
  const isStale = daysInStage > stage.stale_days

  return (
    <div className="w-[248px] rotate-2 cursor-grabbing rounded-lg border border-primary/30 bg-white shadow-modal">
      <div
        className="h-[3px] rounded-t-lg"
        style={{ backgroundColor: stage.color }}
      />
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-heading">
          {deal.contact.first_name} {deal.contact.last_name}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground truncate">
          {deal.title}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-lg font-bold text-primary">
            {currencyFormat.format(deal.value)}
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
    </div>
  )
}
