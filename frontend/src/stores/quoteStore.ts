import { create } from 'zustand'
import { quotesApi } from '@/lib/api'
import type { Quote, QuoteStatus } from '@/types/quote'

export type QuoteSortField = 'title' | 'status' | 'equipment_total' | 'created_at'

const SORT_FIELD_MAP: Record<QuoteSortField, string> = {
  title: 'title',
  status: 'status',
  equipment_total: 'equipment_total',
  created_at: 'created_at',
}

interface QuoteState {
  quotes: Quote[]
  selectedQuoteId: string | null
  search: string
  statusFilter: QuoteStatus | 'all'
  sortField: QuoteSortField
  sortDir: 'asc' | 'desc'
  loading: boolean
  error: string | null

  fetchQuotes: () => Promise<void>
  selectQuote: (id: string | null) => void
  setSearch: (q: string) => void
  setStatusFilter: (status: QuoteStatus | 'all') => void
  setSort: (field: QuoteSortField) => void
  addQuote: (quote: Partial<Quote>) => Promise<Quote>
  updateQuote: (quoteId: string, updates: Partial<Quote>) => Promise<void>
  sendQuote: (quoteId: string) => Promise<void>
  acceptQuote: (quoteId: string) => Promise<void>
  declineQuote: (quoteId: string) => Promise<void>
  deleteQuote: (quoteId: string) => Promise<void>
}

const useQuoteStore = create<QuoteState>((set, get) => ({
  quotes: [],
  selectedQuoteId: null,
  search: '',
  statusFilter: 'all',
  sortField: 'created_at',
  sortDir: 'desc',
  loading: false,
  error: null,

  fetchQuotes: async () => {
    const { search, statusFilter, sortField, sortDir } = get()
    set({ loading: true, error: null })
    try {
      const data = await quotesApi.list({
        page_size: 100,
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        sort_by: SORT_FIELD_MAP[sortField],
        sort_dir: sortDir,
      })
      set({ quotes: data.items, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch quotes' })
    }
  },

  selectQuote: (id) => set({ selectedQuoteId: id }),

  setSearch: (q) => {
    set({ search: q })
    get().fetchQuotes()
  },

  setStatusFilter: (status) => {
    set({ statusFilter: status })
    get().fetchQuotes()
  },

  setSort: (field) => {
    const state = get()
    set({
      sortField: field,
      sortDir: state.sortField === field && state.sortDir === 'asc' ? 'desc' : 'asc',
    })
    get().fetchQuotes()
  },

  addQuote: async (quoteData) => {
    const quote = await quotesApi.create(quoteData)
    set((state) => ({ quotes: [quote, ...state.quotes] }))
    return quote
  },

  updateQuote: async (quoteId, updates) => {
    const updated = await quotesApi.update(quoteId, updates)
    set((state) => ({
      quotes: state.quotes.map((q) => (q.id === quoteId ? updated : q)),
    }))
  },

  sendQuote: async (quoteId) => {
    const updated = await quotesApi.send(quoteId)
    set((state) => ({
      quotes: state.quotes.map((q) => (q.id === quoteId ? updated : q)),
    }))
  },

  acceptQuote: async (quoteId) => {
    const updated = await quotesApi.accept(quoteId)
    set((state) => ({
      quotes: state.quotes.map((q) => (q.id === quoteId ? updated : q)),
    }))
  },

  declineQuote: async (quoteId) => {
    const updated = await quotesApi.update(quoteId, { status: 'rejected' } as Partial<Quote>)
    set((state) => ({
      quotes: state.quotes.map((q) => (q.id === quoteId ? updated : q)),
    }))
  },

  deleteQuote: async (quoteId) => {
    await quotesApi.delete(quoteId)
    set((state) => ({
      quotes: state.quotes.filter((q) => q.id !== quoteId),
    }))
  },
}))

export function useFilteredQuotes() {
  return useQuoteStore((s) => s.quotes)
}

export default useQuoteStore
