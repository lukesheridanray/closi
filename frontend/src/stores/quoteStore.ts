import { create } from 'zustand'
import type { Quote, QuoteLine, QuoteStatus } from '@/types/quote'

export type QuoteSortField = 'title' | 'status' | 'equipment_total' | 'created_at'

interface QuoteState {
  quotes: Quote[]
  selectedQuoteId: string | null
  search: string
  statusFilter: QuoteStatus | 'all'
  sortField: QuoteSortField
  sortDir: 'asc' | 'desc'

  selectQuote: (id: string | null) => void
  setSearch: (q: string) => void
  setStatusFilter: (status: QuoteStatus | 'all') => void
  setSort: (field: QuoteSortField) => void
  addQuote: (quote: Omit<Quote, 'id' | 'org_id' | 'created_at' | 'updated_at'>) => void
  updateQuote: (quoteId: string, updates: Partial<Quote>) => void
  sendQuote: (quoteId: string) => void
  acceptQuote: (quoteId: string) => void
}

const ORG_ID = 'org_01'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

const mockQuotes: Quote[] = [
  {
    id: 'quote_01',
    org_id: ORG_ID,
    deal_id: 'deal_01',
    contact_id: 'contact_01',
    created_by: 'Rep A',
    title: 'Wilson Home Security - Pro Package',
    status: 'accepted',
    equipment_lines: [
      { id: 'ql_01', product_name: 'Control Panel - Smart Hub Pro', quantity: 1, unit_price: 450, total: 450 },
      { id: 'ql_02', product_name: 'Outdoor Camera - 2K Night Vision', quantity: 4, unit_price: 180, total: 720 },
      { id: 'ql_03', product_name: 'Doorbell Camera - HD', quantity: 1, unit_price: 220, total: 220 },
      { id: 'ql_04', product_name: 'Motion Sensor - Indoor', quantity: 6, unit_price: 45, total: 270 },
      { id: 'ql_05', product_name: 'Door/Window Sensor', quantity: 8, unit_price: 30, total: 240 },
      { id: 'ql_06', product_name: 'Installation Labor', quantity: 1, unit_price: 500, total: 500 },
    ],
    equipment_total: 2400,
    monitoring: { monthly_amount: 59.99, term_months: 36, auto_renewal: true },
    total_contract_value: 2400 + (59.99 * 36),
    notes: 'Full home security package with 24/7 professional monitoring.',
    valid_until: daysFromNow(-10),
    sent_at: daysAgo(75),
    accepted_at: daysAgo(70),
    created_at: daysAgo(78),
    updated_at: daysAgo(70),
  },
  {
    id: 'quote_02',
    org_id: ORG_ID,
    deal_id: 'deal_03',
    contact_id: 'contact_03',
    created_by: 'Rep A',
    title: 'TechCorp Office - Commercial Access Control',
    status: 'sent',
    equipment_lines: [
      { id: 'ql_11', product_name: 'Access Control Panel', quantity: 2, unit_price: 800, total: 1600 },
      { id: 'ql_12', product_name: 'Card Reader - Proximity', quantity: 4, unit_price: 250, total: 1000 },
      { id: 'ql_13', product_name: 'Commercial Camera - 4K', quantity: 6, unit_price: 320, total: 1920 },
      { id: 'ql_14', product_name: 'Installation Labor', quantity: 1, unit_price: 1200, total: 1200 },
    ],
    equipment_total: 5720,
    monitoring: { monthly_amount: 149.99, term_months: 36, auto_renewal: false },
    total_contract_value: 5720 + (149.99 * 36),
    notes: 'Commercial access control with SOC2-compliant logging. Pending compliance verification.',
    valid_until: daysFromNow(15),
    sent_at: daysAgo(6),
    accepted_at: null,
    created_at: daysAgo(8),
    updated_at: daysAgo(6),
  },
  {
    id: 'quote_03',
    org_id: ORG_ID,
    deal_id: 'deal_07',
    contact_id: 'contact_07',
    created_by: 'Rep C',
    title: 'Martinez Properties - Monitoring Package',
    status: 'sent',
    equipment_lines: [
      { id: 'ql_21', product_name: 'Control Panel - Standard', quantity: 3, unit_price: 280, total: 840 },
      { id: 'ql_22', product_name: 'Outdoor Camera - 1080p', quantity: 6, unit_price: 140, total: 840 },
      { id: 'ql_23', product_name: 'Motion Sensor - Outdoor', quantity: 6, unit_price: 55, total: 330 },
      { id: 'ql_24', product_name: 'Installation Labor', quantity: 1, unit_price: 800, total: 800 },
    ],
    equipment_total: 2810,
    monitoring: { monthly_amount: 89.99, term_months: 24, auto_renewal: true },
    total_contract_value: 2810 + (89.99 * 24),
    notes: '3 rental properties, 24/7 monitoring with mobile alerts.',
    valid_until: daysFromNow(20),
    sent_at: daysAgo(9),
    accepted_at: null,
    created_at: daysAgo(12),
    updated_at: daysAgo(9),
  },
  {
    id: 'quote_04',
    org_id: ORG_ID,
    deal_id: 'deal_06',
    contact_id: 'contact_06',
    created_by: 'Rep B',
    title: 'Davis Home - Outdoor Camera System',
    status: 'draft',
    equipment_lines: [
      { id: 'ql_31', product_name: 'Outdoor Camera - 2K Night Vision', quantity: 3, unit_price: 180, total: 540 },
      { id: 'ql_32', product_name: 'Spotlight Camera', quantity: 1, unit_price: 250, total: 250 },
      { id: 'ql_33', product_name: 'NVR - 8 Channel', quantity: 1, unit_price: 350, total: 350 },
      { id: 'ql_34', product_name: 'Installation Labor', quantity: 1, unit_price: 400, total: 400 },
    ],
    equipment_total: 1540,
    monitoring: { monthly_amount: 29.99, term_months: 12, auto_renewal: true },
    total_contract_value: 1540 + (29.99 * 12),
    notes: 'Camera-only system, no alarm panel. Self-monitoring option discussed.',
    valid_until: null,
    sent_at: null,
    accepted_at: null,
    created_at: daysAgo(2),
    updated_at: daysAgo(2),
  },
  {
    id: 'quote_05',
    org_id: ORG_ID,
    deal_id: 'deal_04',
    contact_id: 'contact_04',
    created_by: 'Rep C',
    title: 'Thompson Smart Home - Basic Package',
    status: 'rejected',
    equipment_lines: [
      { id: 'ql_41', product_name: 'Smart Lock - Deadbolt', quantity: 2, unit_price: 180, total: 360 },
      { id: 'ql_42', product_name: 'Doorbell Camera - HD', quantity: 1, unit_price: 220, total: 220 },
      { id: 'ql_43', product_name: 'Motion Sensor - Indoor', quantity: 4, unit_price: 45, total: 180 },
      { id: 'ql_44', product_name: 'Installation Labor', quantity: 1, unit_price: 300, total: 300 },
    ],
    equipment_total: 1060,
    monitoring: { monthly_amount: 39.99, term_months: 24, auto_renewal: false },
    total_contract_value: 1060 + (39.99 * 24),
    notes: 'Customer chose competitor. Price was the deciding factor.',
    valid_until: daysFromNow(-20),
    sent_at: daysAgo(30),
    accepted_at: null,
    created_at: daysAgo(35),
    updated_at: daysAgo(25),
  },
]

const useQuoteStore = create<QuoteState>((set) => ({
  quotes: mockQuotes,
  selectedQuoteId: null,
  search: '',
  statusFilter: 'all',
  sortField: 'created_at',
  sortDir: 'desc',

  selectQuote: (id) => set({ selectedQuoteId: id }),
  setSearch: (q) => set({ search: q }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setSort: (field) =>
    set((state) => ({
      sortField: field,
      sortDir: state.sortField === field && state.sortDir === 'asc' ? 'desc' : 'asc',
    })),

  addQuote: (quoteData) =>
    set((state) => {
      const now = new Date().toISOString()
      const newQuote: Quote = {
        ...quoteData,
        id: `quote_${Date.now()}`,
        org_id: ORG_ID,
        created_at: now,
        updated_at: now,
      }
      return { quotes: [newQuote, ...state.quotes] }
    }),

  updateQuote: (quoteId, updates) =>
    set((state) => ({
      quotes: state.quotes.map((q) =>
        q.id === quoteId ? { ...q, ...updates, updated_at: new Date().toISOString() } : q,
      ),
    })),

  sendQuote: (quoteId) =>
    set((state) => ({
      quotes: state.quotes.map((q) =>
        q.id === quoteId
          ? { ...q, status: 'sent' as const, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          : q,
      ),
    })),

  acceptQuote: (quoteId) =>
    set((state) => ({
      quotes: state.quotes.map((q) =>
        q.id === quoteId
          ? { ...q, status: 'accepted' as const, accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          : q,
      ),
    })),
}))

export function useFilteredQuotes() {
  const quotes = useQuoteStore((s) => s.quotes)
  const search = useQuoteStore((s) => s.search)
  const statusFilter = useQuoteStore((s) => s.statusFilter)
  const sortField = useQuoteStore((s) => s.sortField)
  const sortDir = useQuoteStore((s) => s.sortDir)

  const q = search.toLowerCase()
  let filtered = quotes.filter((quote) => {
    if (statusFilter !== 'all' && quote.status !== statusFilter) return false
    if (q && !quote.title.toLowerCase().includes(q)) return false
    return true
  })

  filtered = [...filtered].sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case 'title': cmp = a.title.localeCompare(b.title); break
      case 'status': cmp = a.status.localeCompare(b.status); break
      case 'equipment_total': cmp = a.equipment_total - b.equipment_total; break
      case 'created_at': cmp = a.created_at.localeCompare(b.created_at); break
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  return filtered
}

export default useQuoteStore
