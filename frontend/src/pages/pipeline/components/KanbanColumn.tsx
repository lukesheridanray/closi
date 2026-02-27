import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { DealWithContact, PipelineStage } from '@/types/pipeline'
import DealCard from './DealCard'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

interface KanbanColumnProps {
  stage: PipelineStage
  deals: DealWithContact[]
  onDealClick: (dealId: string) => void
}

export default function KanbanColumn({ stage, deals, onDealClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0)
  const isDimmed = stage.is_won || stage.is_lost

  return (
    <div
      className={`flex min-w-[280px] w-[280px] flex-shrink-0 flex-col ${
        isDimmed ? 'opacity-75' : ''
      }`}
    >
      {/* Column header */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: stage.color }}
        />
        <h3 className="text-sm font-semibold text-heading truncate">
          {stage.name}
        </h3>
        <span className="ml-auto flex-shrink-0 rounded-full bg-page px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {deals.length}
        </span>
      </div>

      {/* Total value */}
      <p className="mb-3 text-xs font-medium text-muted-foreground">
        {currencyFormat.format(totalValue)}
      </p>

      {/* Droppable card list */}
      <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex flex-1 flex-col gap-2 rounded-lg p-1.5 min-h-[100px] transition-colors ${
            isOver ? 'bg-primary/5 ring-1 ring-primary/20' : ''
          }`}
        >
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              stage={stage}
              onClick={() => onDealClick(deal.id)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
