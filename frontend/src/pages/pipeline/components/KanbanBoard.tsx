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
import usePipelineStore from '@/stores/pipelineStore'
import type { DealWithContact } from '@/types/pipeline'
import KanbanColumn from './KanbanColumn'
import { DealCardOverlay } from './DealCard'

export default function KanbanBoard() {
  const stages = usePipelineStore((s) => s.stages)
  const deals = usePipelineStore((s) => s.deals)
  const contacts = usePipelineStore((s) => s.contacts)
  const activePipelineId = usePipelineStore((s) => s.activePipelineId)
  const moveDeal = usePipelineStore((s) => s.moveDeal)
  const selectDeal = usePipelineStore((s) => s.selectDeal)

  const [activeDealId, setActiveDealId] = useState<string | null>(null)

  const pipelineStages = useMemo(
    () => stages.filter((s) => s.pipeline_id === activePipelineId).sort((a, b) => a.position - b.position),
    [stages, activePipelineId],
  )

  // Build deals with contacts, grouped by stage
  const contactMap = useMemo(() => {
    const map = new Map<string, typeof contacts[0]>()
    contacts.forEach((c) => map.set(c.id, c))
    return map
  }, [contacts])

  const dealsByStage = useMemo(() => {
    const map = new Map<string, DealWithContact[]>()
    pipelineStages.forEach((s) => map.set(s.id, []))
    deals.forEach((d) => {
      if (d.pipeline_id !== activePipelineId) return
      const contact = contactMap.get(d.contact_id)
      if (!contact) return
      const stageDeals = map.get(d.stage_id)
      if (stageDeals) {
        stageDeals.push({ ...d, contact })
      }
    })
    return map
  }, [deals, pipelineStages, activePipelineId, contactMap])

  // Active deal for DragOverlay
  const activeDeal = useMemo(() => {
    if (!activeDealId) return null
    const deal = deals.find((d) => d.id === activeDealId)
    if (!deal) return null
    const contact = contactMap.get(deal.contact_id)
    if (!contact) return null
    return { ...deal, contact } as DealWithContact
  }, [activeDealId, deals, contactMap])

  const activeStage = useMemo(
    () => (activeDeal ? stages.find((s) => s.id === activeDeal.stage_id) : null),
    [activeDeal, stages],
  )

  // Sensors with distance activation (8px) to distinguish click vs drag
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

      // Determine target stage: if over a deal, find its stage; if over a stage container, use that
      let targetStageId: string | null = null

      // Check if overId is a stage
      const isStage = pipelineStages.some((s) => s.id === overId)
      if (isStage) {
        targetStageId = overId
      } else {
        // overId is a deal; find which stage it belongs to
        const overDeal = deals.find((d) => d.id === overId)
        if (overDeal) {
          targetStageId = overDeal.stage_id
        }
      }

      if (targetStageId) {
        moveDeal(dealId, targetStageId)
      }
    },
    [deals, pipelineStages, moveDeal],
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
        {pipelineStages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={dealsByStage.get(stage.id) ?? []}
            onDealClick={(dealId) => selectDeal(dealId)}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDeal && activeStage ? (
          <DealCardOverlay deal={activeDeal} stage={activeStage} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
