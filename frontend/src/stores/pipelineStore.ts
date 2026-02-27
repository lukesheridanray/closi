import { create } from 'zustand'
import { pipelinesApi, dealsApi, contactsApi } from '@/lib/api'
import type { Pipeline, PipelineStage, Deal, StageHistory } from '@/types/pipeline'
import type { Contact } from '@/types/contact'

interface PipelineState {
  pipelines: Pipeline[]
  stages: PipelineStage[]
  deals: Deal[]
  contacts: Contact[]
  stageHistory: StageHistory[]
  activePipelineId: string | null
  selectedDealId: string | null
  loading: boolean
  error: string | null

  fetchPipelines: () => Promise<void>
  fetchDeals: (pipelineId?: string) => Promise<void>
  selectDeal: (dealId: string | null) => void
  moveDeal: (dealId: string, toStageId: string) => Promise<void>
  createDeal: (data: Partial<Deal>) => Promise<Deal>
  renamePipeline: (pipelineId: string, name: string) => void
  addStage: (pipelineId: string, stage: Partial<PipelineStage>) => Promise<void>
  updateStage: (stageId: string, updates: Partial<PipelineStage>) => Promise<void>
  deleteStage: (stageId: string, reassignToStageId?: string) => Promise<void>
  reorderStages: (pipelineId: string, orderedIds: string[]) => Promise<void>
}

const usePipelineStore = create<PipelineState>((set, get) => ({
  pipelines: [],
  stages: [],
  deals: [],
  contacts: [],
  stageHistory: [],
  activePipelineId: null,
  selectedDealId: null,
  loading: false,
  error: null,

  fetchPipelines: async () => {
    set({ loading: true, error: null })
    try {
      const pipelines = await pipelinesApi.list()
      const allStages: PipelineStage[] = []
      for (const p of pipelines) {
        if (p.stages) allStages.push(...p.stages)
      }
      const activePipelineId = pipelines.find((p) => p.is_default)?.id ?? pipelines[0]?.id ?? null
      set({ pipelines, stages: allStages, activePipelineId, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch pipelines' })
    }
  },

  fetchDeals: async (pipelineId?: string) => {
    const pid = pipelineId ?? get().activePipelineId
    if (!pid) return
    set({ loading: true, error: null })
    try {
      const [dealData, contactData] = await Promise.all([
        dealsApi.list({ pipeline_id: pid, page_size: 100 }),
        contactsApi.list({ page_size: 100 }),
      ])
      set({ deals: dealData.items, contacts: contactData.items, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch deals' })
    }
  },

  selectDeal: (dealId) => set({ selectedDealId: dealId }),

  moveDeal: async (dealId, toStageId) => {
    const deal = get().deals.find((d) => d.id === dealId)
    if (!deal || deal.stage_id === toStageId) return

    // Optimistic update
    set((state) => ({
      deals: state.deals.map((d) =>
        d.id === dealId ? { ...d, stage_id: toStageId, updated_at: new Date().toISOString() } : d,
      ),
    }))

    try {
      await dealsApi.moveStage(dealId, toStageId)
    } catch {
      // Revert on failure
      set((state) => ({
        deals: state.deals.map((d) =>
          d.id === dealId ? { ...d, stage_id: deal.stage_id } : d,
        ),
      }))
    }
  },

  createDeal: async (data) => {
    const deal = await dealsApi.create(data)
    set((state) => ({ deals: [deal, ...state.deals] }))
    return deal
  },

  renamePipeline: (pipelineId, name) =>
    set((state) => ({
      pipelines: state.pipelines.map((p) =>
        p.id === pipelineId ? { ...p, name, updated_at: new Date().toISOString() } : p,
      ),
    })),

  addStage: async (pipelineId, stageData) => {
    try {
      const stage = await pipelinesApi.createStage(pipelineId, stageData)
      set((state) => ({ stages: [...state.stages, stage] }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create stage' })
    }
  },

  updateStage: async (stageId, updates) => {
    const stage = get().stages.find((s) => s.id === stageId)
    if (!stage) return
    try {
      const updated = await pipelinesApi.updateStage(stage.pipeline_id, stageId, updates)
      set((state) => ({
        stages: state.stages.map((s) => (s.id === stageId ? updated : s)),
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update stage' })
    }
  },

  deleteStage: async (stageId, reassignToStageId?) => {
    const stage = get().stages.find((s) => s.id === stageId)
    if (!stage) return
    try {
      await pipelinesApi.deleteStage(stage.pipeline_id, stageId)
      set((state) => {
        const updatedStages = state.stages.filter((s) => s.id !== stageId)
        let updatedDeals = state.deals
        if (reassignToStageId) {
          updatedDeals = state.deals.map((d) =>
            d.stage_id === stageId
              ? { ...d, stage_id: reassignToStageId, updated_at: new Date().toISOString() }
              : d,
          )
        }
        return { stages: updatedStages, deals: updatedDeals }
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete stage' })
    }
  },

  reorderStages: async (pipelineId, orderedIds) => {
    // Optimistic update
    set((state) => ({
      stages: state.stages.map((s) => {
        if (s.pipeline_id !== pipelineId) return s
        const newPosition = orderedIds.indexOf(s.id)
        return newPosition >= 0 ? { ...s, sort_order: newPosition } : s
      }),
    }))

    try {
      await pipelinesApi.reorderStages(pipelineId, orderedIds)
    } catch {
      // Re-fetch on failure
      get().fetchPipelines()
    }
  },
}))

export default usePipelineStore
