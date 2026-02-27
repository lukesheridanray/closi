import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import type { DealWithContact, PipelineStage } from '@/types/pipeline'
import KanbanCard from './KanbanCard'

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
      className={`min-w-[280px] w-[280px] flex-shrink-0 flex flex-col rounded-xl border border-border bg-white shadow-card ${
        isDimmed ? 'opacity-75' : ''
      }`}
    >
      {/* Colored header bar */}
      <div
        className="rounded-t-lg px-3 py-2.5 flex items-center gap-2"
        style={{ backgroundColor: stage.color }}
      >
        <h3 className="text-sm font-semibold text-white truncate">
          {stage.name}
        </h3>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white flex-shrink-0">
          {deals.length}
        </span>
        <span className="ml-auto text-xs font-medium text-white/90 flex-shrink-0">
          {currencyFormat.format(totalValue)}
        </span>
      </div>

      {/* Card area */}
      <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`overflow-y-auto flex-1 space-y-2 p-2 min-h-[80px] transition-colors ${
            isOver ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''
          }`}
        >
          {deals.length > 0 ? (
            deals.map((deal) => (
              <KanbanCard
                key={deal.id}
                deal={deal}
                stage={stage}
                onClick={() => onDealClick(deal.id)}
              />
            ))
          ) : (
            <p className="text-sm italic text-muted-foreground py-4 text-center">
              No deals
            </p>
          )}
        </div>
      </SortableContext>

      {/* Footer */}
      <div className="border-t border-border px-3 py-2">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-heading transition-colors w-full">
          <Plus className="h-4 w-4" />
          Add Deal
        </button>
      </div>
    </div>
  )
}
