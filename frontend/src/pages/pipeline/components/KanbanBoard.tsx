import { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { PipelineStage, DealWithContact, Contact } from '@/types/pipeline'
import KanbanColumn from './KanbanColumn'
import { KanbanCardOverlay } from './KanbanCard'

interface KanbanBoardProps {
  stages: PipelineStage[]
  dealsByStage: Map<string, DealWithContact[]>
  contactMap: Map<string, Contact>
  deals: DealWithContact[]
  onDealClick: (dealId: string) => void
  onMoveDeal: (dealId: string, toStageId: string) => void
}

export default function KanbanBoard({
  stages,
  dealsByStage,
  contactMap,
  deals,
  onDealClick,
  onMoveDeal,
}: KanbanBoardProps) {
  const [activeDealId, setActiveDealId] = useState<string | null>(null)

  const activeDeal = useMemo(() => {
    if (!activeDealId) return null
    return deals.find((d) => d.id === activeDealId) ?? null
  }, [activeDealId, deals])

  const activeStage = useMemo(
    () => (activeDeal ? stages.find((s) => s.id === activeDeal.stage_id) : null),
    [activeDeal, stages],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDealId(event.active.id as string)
  }, [])

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) return

      const dealId = active.id as string
      const overId = over.id as string

      let targetStageId: string | null = null

      const isStage = stages.some((s) => s.id === overId)
      if (isStage) {
        targetStageId = overId
      } else {
        // overId is a deal; find which stage it belongs to
        for (const [stageId, stageDeals] of dealsByStage) {
          if (stageDeals.some((d) => d.id === overId)) {
            targetStageId = stageId
            break
          }
        }
      }

      if (targetStageId) {
        onMoveDeal(dealId, targetStageId)
      }
    },
    [stages, dealsByStage, onMoveDeal],
  )

  const handleDragEnd = useCallback((_event: DragEndEvent) => {
    setActiveDealId(null)
  }, [])

  const handleDragCancel = useCallback(() => {
    setActiveDealId(null)
  }, [])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={dealsByStage.get(stage.id) ?? []}
            onDealClick={onDealClick}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDeal && activeStage ? (
          <KanbanCardOverlay deal={activeDeal} stage={activeStage} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
