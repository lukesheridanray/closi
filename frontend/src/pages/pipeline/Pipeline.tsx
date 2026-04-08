import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, DollarSign, Clock, User } from 'lucide-react'
import { Search } from 'lucide-react'
import usePipelineStore from '@/stores/pipelineStore'
import useContactStore from '@/stores/contactStore'
import { dealsApi } from '@/lib/api'
import { useSchedulingPrompt, SchedulingModal } from '@/hooks/useSchedulingPrompt'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export default function Pipeline() {
  const navigate = useNavigate()
  const deals = usePipelineStore((s) => s.deals)
  const stages = usePipelineStore((s) => s.stages)
  const loading = usePipelineStore((s) => s.loading)
  const fetchPipelines = usePipelineStore((s) => s.fetchPipelines)
  const fetchDeals = usePipelineStore((s) => s.fetchDeals)
  const activePipelineId = usePipelineStore((s) => s.activePipelineId)
  const moveDeal = usePipelineStore((s) => s.moveDeal)
  const contacts = useContactStore((s) => s.contacts)
  const fetchContacts = useContactStore((s) => s.fetchContacts)
  const scheduling = useSchedulingPrompt()

  const [dragDealId, setDragDealId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [showAddToPipeline, setShowAddToPipeline] = useState(false)
  const [addSearch, setAddSearch] = useState('')

  // Contacts not already in the pipeline
  const contactsInPipeline = useMemo(() => new Set(deals.map((d) => d.contact_id)), [deals])
  const availableContacts = useMemo(() => {
    const filtered = contacts.filter((c) => !contactsInPipeline.has(c.id))
    if (!addSearch.trim()) return filtered
    const q = addSearch.toLowerCase()
    return filtered.filter((c) =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.company ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    )
  }, [contacts, contactsInPipeline, addSearch])

  useEffect(() => { fetchPipelines() }, [fetchPipelines])
  useEffect(() => { if (activePipelineId) fetchDeals(activePipelineId) }, [activePipelineId, fetchDeals])
  useEffect(() => { fetchContacts() }, [fetchContacts])

  const contactMap = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts])

  // Sort stages by sort_order, filter active
  const sortedStages = useMemo(() =>
    stages
      .filter((s) => s.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
  , [stages])

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const map: Record<string, typeof deals> = {}
    sortedStages.forEach((s) => { map[s.id] = [] })
    deals.forEach((d) => {
      if (map[d.stage_id]) map[d.stage_id].push(d)
    })
    return map
  }, [deals, sortedStages])

  // Stage totals
  const stageTotals = useMemo(() => {
    const totals: Record<string, { count: number; value: number }> = {}
    sortedStages.forEach((s) => {
      const stageDeals = dealsByStage[s.id] ?? []
      totals[s.id] = {
        count: stageDeals.length,
        value: stageDeals.reduce((sum, d) => sum + d.estimated_value, 0),
      }
    })
    return totals
  }, [dealsByStage, sortedStages])

  function handleDragStart(dealId: string) {
    setDragDealId(dealId)
  }

  function handleDragOver(e: React.DragEvent, stageId: string) {
    e.preventDefault()
    setDragOverStage(stageId)
  }

  function handleDragLeave() {
    setDragOverStage(null)
  }

  function handleDrop(stageId: string) {
    if (dragDealId && stageId) {
      const deal = deals.find((d) => d.id === dragDealId)
      if (deal && deal.stage_id !== stageId) {
        const contact = contactMap.get(deal.contact_id)
        const contactName = contact ? `${contact.first_name} ${contact.last_name}` : ''
        scheduling.interceptMoveDeal(dragDealId, stageId, deal.contact_id, contactName)
      }
    }
    setDragDealId(null)
    setDragOverStage(null)
  }

  function daysInStage(deal: typeof deals[0]) {
    const updated = new Date(deal.updated_at)
    const now = new Date()
    return Math.max(0, Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24)))
  }

  if (loading && stages.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading pipeline...</div>
  }

  return (
    <div className="h-[calc(100vh-theme(spacing.12)-theme(spacing.14))]">
      {/* Pipeline header */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {deals.length} deal{deals.length !== 1 ? 's' : ''} &middot; {currencyFormat.format(deals.reduce((s, d) => s + d.estimated_value, 0))} total value
        </p>
        <button
          onClick={() => { setShowAddToPipeline(true); setAddSearch('') }}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" /> Add to Pipeline
        </button>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-3 overflow-x-auto pb-4 h-full">
        {sortedStages.map((stage) => {
          const stageDeals = dealsByStage[stage.id] ?? []
          const totals = stageTotals[stage.id]
          const isOver = dragOverStage === stage.id

          return (
            <div
              key={stage.id}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(stage.id)}
              className={`flex w-72 min-w-[288px] flex-shrink-0 flex-col rounded-xl border transition-colors ${
                isOver ? 'border-primary/40 bg-primary/5' : 'border-border bg-page/40'
              }`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color ?? '#6C63FF' }} />
                  <h3 className="text-xs font-semibold text-heading truncate">{stage.name}</h3>
                  <span className="flex-shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">
                    {totals.count}
                  </span>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground flex-shrink-0">
                  {currencyFormat.format(totals.value)}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {stageDeals.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border py-6 text-center text-[10px] text-muted-foreground">
                    No deals
                  </div>
                )}
                {stageDeals
                  .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                  .map((deal) => {
                    const contact = contactMap.get(deal.contact_id)
                    const days = daysInStage(deal)
                    const isDragging = dragDealId === deal.id

                    return (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={() => handleDragStart(deal.id)}
                        onClick={() => navigate(`/accounts/${deal.contact_id}`)}
                        className={`cursor-pointer rounded-lg border border-border bg-white p-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${
                          isDragging ? 'opacity-40' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-heading truncate">{deal.title}</p>
                            {contact && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                                <User className="h-2.5 w-2.5" />
                                <span className="truncate">{contact.first_name} {contact.last_name}</span>
                              </div>
                            )}
                          </div>
                          <span className="flex-shrink-0 text-xs font-bold text-primary">
                            {currencyFormat.format(deal.estimated_value)}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            <span>{days}d</span>
                          </div>
                          {contact?.company && (
                            <span className="truncate text-[10px] text-muted-foreground">{contact.company}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )
        })}
      </div>

      <SchedulingModal {...scheduling} />

      {/* Add to Pipeline modal */}
      {showAddToPipeline && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowAddToPipeline(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-modal overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <h3 className="text-sm font-semibold text-heading">Add Account to Pipeline</h3>
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={addSearch}
                    onChange={(e) => setAddSearch(e.target.value)}
                    placeholder="Search accounts..."
                    autoFocus
                    className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-heading outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {availableContacts.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                    {contacts.length === contactsInPipeline.size ? 'All accounts are already in the pipeline' : 'No matching accounts'}
                  </p>
                ) : (
                  availableContacts.map((c) => (
                    <button
                      key={c.id}
                      onClick={async () => {
                        if (!activePipelineId) return
                        const firstStage = sortedStages.find((s) => !s.is_won_stage && !s.is_lost_stage)
                        if (!firstStage) return
                        await dealsApi.create({
                          contact_id: c.id,
                          pipeline_id: activePipelineId,
                          stage_id: firstStage.id,
                          title: `${c.first_name} ${c.last_name}`,
                          estimated_value: 0,
                        })
                        fetchDeals(activePipelineId)
                        setShowAddToPipeline(false)
                      }}
                      className="flex w-full items-center gap-3 border-b border-border px-5 py-3 text-left hover:bg-page transition-colors"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {c.first_name[0]}{c.last_name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-heading truncate">{c.first_name} {c.last_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {[c.company, c.email, c.phone].filter(Boolean).join(' - ')}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="border-t border-border px-5 py-3">
                <button onClick={() => setShowAddToPipeline(false)} className="text-xs font-medium text-muted-foreground hover:text-heading">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
