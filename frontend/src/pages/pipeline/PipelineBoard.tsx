import { useState, useMemo } from 'react'
import usePipelineStore from '@/stores/pipelineStore'
import SlideOutPanel from '@/components/layout/SlideOutPanel'
import PipelineToolbar from './components/PipelineToolbar'
import PipelineTable from './components/PipelineTable'
import KanbanBoard from './components/KanbanBoard'
import DealDetailPanel from './components/DealDetailPanel'
import type { DealWithContact } from '@/types/pipeline'

type ViewTab = 'table' | 'board'

export default function PipelineBoard() {
  const selectedDealId = usePipelineStore((s) => s.selectedDealId)
  const deals = usePipelineStore((s) => s.deals)
  const contacts = usePipelineStore((s) => s.contacts)
  const stages = usePipelineStore((s) => s.stages)
  const activePipelineId = usePipelineStore((s) => s.activePipelineId)
  const selectDeal = usePipelineStore((s) => s.selectDeal)
  const moveDeal = usePipelineStore((s) => s.moveDeal)

  const [activeView, setActiveView] = useState<ViewTab>('table')
  const [search, setSearch] = useState('')

  // Pipeline stages sorted by position
  const pipelineStages = useMemo(
    () => stages.filter((s) => s.pipeline_id === activePipelineId).sort((a, b) => a.position - b.position),
    [stages, activePipelineId],
  )

  // Contact lookup map
  const contactMap = useMemo(() => {
    const map = new Map<string, typeof contacts[0]>()
    contacts.forEach((c) => map.set(c.id, c))
    return map
  }, [contacts])

  // Deals grouped by stage, filtered by search
  const dealsByStage = useMemo(() => {
    const map = new Map<string, DealWithContact[]>()
    pipelineStages.forEach((s) => map.set(s.id, []))

    const term = search.toLowerCase().trim()

    deals.forEach((d) => {
      if (d.pipeline_id !== activePipelineId) return
      const contact = contactMap.get(d.contact_id)
      if (!contact) return

      // Search filter
      if (term) {
        const matchTitle = d.title.toLowerCase().includes(term)
        const matchFirst = contact.first_name.toLowerCase().includes(term)
        const matchLast = contact.last_name.toLowerCase().includes(term)
        if (!matchTitle && !matchFirst && !matchLast) return
      }

      const stageDeals = map.get(d.stage_id)
      if (stageDeals) {
        stageDeals.push({ ...d, contact })
      }
    })
    return map
  }, [deals, pipelineStages, activePipelineId, contactMap, search])

  // Flat list of all visible deals (for KanbanBoard)
  const allVisibleDeals = useMemo(() => {
    const result: DealWithContact[] = []
    for (const stageDeals of dealsByStage.values()) {
      result.push(...stageDeals)
    }
    return result
  }, [dealsByStage])

  // Resolve selected deal + contact + stage for slide-out
  const selectedDeal = selectedDealId ? deals.find((d) => d.id === selectedDealId) : null
  const selectedContact = selectedDeal ? contacts.find((c) => c.id === selectedDeal.contact_id) : null
  const selectedStage = selectedDeal ? stages.find((s) => s.id === selectedDeal.stage_id) : null

  const dealWithContact = selectedDeal && selectedContact
    ? { ...selectedDeal, contact: selectedContact }
    : null

  const handleDealClick = (dealId: string) => selectDeal(dealId)

  const tabClass = (tab: ViewTab) =>
    tab === activeView
      ? 'border-b-2 border-primary text-primary font-semibold px-4 py-2 text-sm -mb-px'
      : 'text-muted-foreground hover:text-heading px-4 py-2 text-sm -mb-px'

  return (
    <div className="space-y-4">
      <PipelineToolbar search={search} onSearchChange={setSearch} />

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border">
        <button className={tabClass('table')} onClick={() => setActiveView('table')}>
          Table
        </button>
        <button className={tabClass('board')} onClick={() => setActiveView('board')}>
          Board
        </button>
      </div>

      {/* Active view */}
      {activeView === 'table' ? (
        <PipelineTable
          stages={pipelineStages}
          dealsByStage={dealsByStage}
          allStages={pipelineStages}
          onDealClick={handleDealClick}
          onMoveDeal={moveDeal}
        />
      ) : (
        <KanbanBoard
          stages={pipelineStages}
          dealsByStage={dealsByStage}
          contactMap={contactMap}
          deals={allVisibleDeals}
          onDealClick={handleDealClick}
          onMoveDeal={moveDeal}
        />
      )}

      <SlideOutPanel
        open={!!dealWithContact}
        onClose={() => selectDeal(null)}
        title={dealWithContact?.title ?? 'Deal Details'}
        width="md"
      >
        {dealWithContact && selectedStage && (
          <DealDetailPanel deal={dealWithContact} stage={selectedStage} />
        )}
      </SlideOutPanel>
    </div>
  )
}
