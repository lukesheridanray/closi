import { useState, useMemo, useEffect } from 'react'
import usePipelineStore from '@/stores/pipelineStore'
import { useSchedulingPrompt, SchedulingModal } from '@/hooks/useSchedulingPrompt'
import { useEntityLabels } from '@/hooks/useEntityLabels'
import SlideOutPanel from '@/components/layout/SlideOutPanel'
import PipelineToolbar from './components/PipelineToolbar'
import PipelineTable from './components/PipelineTable'
import KanbanBoard from './components/KanbanBoard'
import DealDetailPanel from './components/DealDetailPanel'
import CreateDealModal from './components/CreateDealModal'
import DealCSVImportModal from './components/DealCSVImportModal'
import type { DealWithContact } from '@/types/pipeline'

type ViewTab = 'table' | 'board'

export default function PipelineBoard() {
  const { deal: dealLabel } = useEntityLabels()
  const selectedDealId = usePipelineStore((s) => s.selectedDealId)
  const selectedDeal = usePipelineStore((s) => s.selectedDeal)
  const selectedDealContact = usePipelineStore((s) => s.selectedDealContact)
  const deals = usePipelineStore((s) => s.deals)
  const contacts = usePipelineStore((s) => s.contacts)
  const stages = usePipelineStore((s) => s.stages)
  const activePipelineId = usePipelineStore((s) => s.activePipelineId)
  const selectDeal = usePipelineStore((s) => s.selectDeal)
  const fetchDealById = usePipelineStore((s) => s.fetchDealById)
  const moveDeal = usePipelineStore((s) => s.moveDeal)
  const loading = usePipelineStore((s) => s.loading)
  const fetchPipelines = usePipelineStore((s) => s.fetchPipelines)
  const fetchDeals = usePipelineStore((s) => s.fetchDeals)

  useEffect(() => { fetchPipelines() }, [fetchPipelines])
  useEffect(() => {
    if (activePipelineId) fetchDeals(activePipelineId)
  }, [activePipelineId, fetchDeals])
  useEffect(() => {
    if (selectedDealId && !selectedDeal) {
      fetchDealById(selectedDealId)
    }
  }, [fetchDealById, selectedDeal, selectedDealId])

  const scheduling = useSchedulingPrompt()

  const [activeView, setActiveView] = useState<ViewTab>('table')
  const [search, setSearch] = useState('')
  const [showCreateDeal, setShowCreateDeal] = useState(false)
  const [showImport, setShowImport] = useState(false)

  // Pipeline stages sorted by position
  const pipelineStages = useMemo(
    () => stages.filter((s) => s.pipeline_id === activePipelineId).sort((a, b) => a.sort_order - b.sort_order),
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
  const resolvedSelectedDeal = selectedDeal ?? (selectedDealId ? deals.find((d) => d.id === selectedDealId) ?? null : null)
  const selectedContact = selectedDealContact ?? (resolvedSelectedDeal ? contacts.find((c) => c.id === resolvedSelectedDeal.contact_id) ?? null : null)
  const selectedStage = resolvedSelectedDeal?.stage_id ? stages.find((s) => s.id === resolvedSelectedDeal.stage_id) : null

  const dealWithContact = resolvedSelectedDeal && selectedContact
    ? { ...resolvedSelectedDeal, contact: selectedContact }
    : null

  // Intercept stage moves that need scheduling
  const handleMoveDeal = (dealId: string, toStageId: string) => {
    const deal = deals.find((d) => d.id === dealId)
    const contact = deal ? contactMap.get(deal.contact_id) : null
    const customerName = contact ? `${contact.first_name} ${contact.last_name}` : deal?.title ?? ''
    scheduling.interceptMoveDeal(dealId, toStageId, deal?.contact_id ?? '', customerName)
  }

  const handleDealClick = (dealId: string) => selectDeal(dealId)

  const tabClass = (tab: ViewTab) =>
    tab === activeView
      ? 'border-b-2 border-primary text-primary font-semibold px-4 py-2 text-sm -mb-px'
      : 'text-muted-foreground hover:text-heading px-4 py-2 text-sm -mb-px'

  if (loading && deals.length === 0 && stages.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading pipeline...</div>
  }

  return (
    <div className="space-y-4">
      <PipelineToolbar search={search} onSearchChange={setSearch} onNewDeal={() => setShowCreateDeal(true)} onImport={() => setShowImport(true)} />

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
          onMoveDeal={handleMoveDeal}
        />
      ) : (
        <KanbanBoard
          stages={pipelineStages}
          dealsByStage={dealsByStage}
          contactMap={contactMap}
          deals={allVisibleDeals}
          onDealClick={handleDealClick}
          onMoveDeal={handleMoveDeal}
        />
      )}

      <SlideOutPanel
        open={!!dealWithContact}
        onClose={() => selectDeal(null)}
        title={dealWithContact?.title ?? `${dealLabel.singular} Details`}
        width="md"
      >
        {dealWithContact && selectedStage && (
          <DealDetailPanel deal={dealWithContact} stage={selectedStage} />
        )}
      </SlideOutPanel>

      <CreateDealModal open={showCreateDeal} onClose={() => setShowCreateDeal(false)} />

      <SchedulingModal {...scheduling} />

      {showImport && (
        <DealCSVImportModal
          onClose={() => {
            setShowImport(false)
            if (activePipelineId) fetchDeals(activePipelineId)
          }}
        />
      )}
    </div>
  )
}
