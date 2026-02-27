import { useState, useMemo, useCallback } from 'react'
import { differenceInDays } from 'date-fns'
import type { PipelineStage, DealWithContact } from '@/types/pipeline'
import StageTableSection, { type SortField, type SortDir } from './StageTableSection'

interface PipelineTableProps {
  stages: PipelineStage[]
  dealsByStage: Map<string, DealWithContact[]>
  allStages: PipelineStage[]
  onDealClick: (dealId: string) => void
  onMoveDeal: (dealId: string, toStageId: string) => void
}

export default function PipelineTable({
  stages,
  dealsByStage,
  allStages,
  onDealClick,
  onMoveDeal,
}: PipelineTableProps) {
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set())
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleToggleCollapse = useCallback((stageId: string) => {
    setCollapsedStages((prev) => {
      const next = new Set(prev)
      if (next.has(stageId)) {
        next.delete(stageId)
      } else {
        next.add(stageId)
      }
      return next
    })
  }, [])

  const handleToggleSelect = useCallback((dealId: string) => {
    setSelectedDeals((prev) => {
      const next = new Set(prev)
      if (next.has(dealId)) {
        next.delete(dealId)
      } else {
        next.add(dealId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback((_stageId: string, dealIds: string[]) => {
    setSelectedDeals((prev) => {
      const allSelected = dealIds.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allSelected) {
        dealIds.forEach((id) => next.delete(id))
      } else {
        dealIds.forEach((id) => next.add(id))
      }
      return next
    })
  }, [])

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return field
      }
      setSortDir('asc')
      return field
    })
  }, [])

  // Sort deals within each stage
  const sortedDealsByStage = useMemo(() => {
    if (!sortField) return dealsByStage

    const sorted = new Map<string, DealWithContact[]>()
    for (const [stageId, deals] of dealsByStage) {
      const copy = [...deals]
      copy.sort((a, b) => {
        let cmp = 0
        switch (sortField) {
          case 'title':
            cmp = a.title.localeCompare(b.title)
            break
          case 'contact':
            cmp = a.contact.last_name.localeCompare(b.contact.last_name)
            break
          case 'assigned_to':
            cmp = (a.assigned_to ?? '').localeCompare(b.assigned_to ?? '')
            break
          case 'value':
            cmp = a.value - b.value
            break
          case 'daysInStage': {
            const daysA = differenceInDays(new Date(), new Date(a.updated_at))
            const daysB = differenceInDays(new Date(), new Date(b.updated_at))
            cmp = daysA - daysB
            break
          }
          case 'expected_close_date': {
            const dateA = a.expected_close_date ?? ''
            const dateB = b.expected_close_date ?? ''
            cmp = dateA.localeCompare(dateB)
            break
          }
        }
        return sortDir === 'desc' ? -cmp : cmp
      })
      sorted.set(stageId, copy)
    }
    return sorted
  }, [dealsByStage, sortField, sortDir])

  return (
    <div className="space-y-3">
      {stages.map((stage) => (
        <StageTableSection
          key={stage.id}
          stage={stage}
          deals={sortedDealsByStage.get(stage.id) ?? []}
          allStages={allStages}
          collapsed={collapsedStages.has(stage.id)}
          onToggleCollapse={() => handleToggleCollapse(stage.id)}
          selectedDeals={selectedDeals}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onDealClick={onDealClick}
          onMoveDeal={onMoveDeal}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
        />
      ))}
    </div>
  )
}
