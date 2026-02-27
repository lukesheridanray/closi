import { create } from 'zustand'
import { invoicesApi } from '@/lib/api'
import type { Invoice, InvoiceStatus, InvoiceLine } from '@/types/invoice'

interface InvoiceState {
  invoices: Invoice[]
  selectedInvoiceId: string | null
  search: string
  statusFilter: InvoiceStatus | 'all'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  loading: boolean
  error: string | null

  fetchInvoices: () => Promise<void>
  selectInvoice: (id: string | null) => void
  setSearch: (q: string) => void
  setStatusFilter: (status: InvoiceStatus | 'all') => void
  setPage: (page: number) => void
  sendInvoice: (id: string) => Promise<void>
  markPaid: (id: string) => Promise<void>
  voidInvoice: (id: string) => Promise<void>
  createInvoice: (data: Partial<Invoice>) => Promise<Invoice>
}

const useInvoiceStore = create<InvoiceState>((set, get) => ({
  invoices: [],
  selectedInvoiceId: null,
  search: '',
  statusFilter: 'all',
  page: 1,
  pageSize: 10,
  totalCount: 0,
  totalPages: 1,
  loading: false,
  error: null,

  fetchInvoices: async () => {
    const { search, statusFilter, page, pageSize } = get()
    set({ loading: true, error: null })
    try {
      const data = await invoicesApi.list({
        page,
        page_size: pageSize,
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })
      set({
        invoices: data.items,
        totalCount: data.meta.total_count,
        totalPages: data.meta.total_pages,
        loading: false,
      })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch invoices' })
    }
  },

  selectInvoice: (id) => set({ selectedInvoiceId: id }),

  setSearch: (q) => {
    set({ search: q, page: 1 })
    get().fetchInvoices()
  },

  setStatusFilter: (status) => {
    set({ statusFilter: status, page: 1 })
    get().fetchInvoices()
  },

  setPage: (page) => {
    set({ page })
    get().fetchInvoices()
  },

  sendInvoice: async (id) => {
    const updated = await invoicesApi.send(id)
    set((state) => ({
      invoices: state.invoices.map((inv) => (inv.id === id ? updated : inv)),
    }))
  },

  markPaid: async (id) => {
    const updated = await invoicesApi.markPaid(id)
    set((state) => ({
      invoices: state.invoices.map((inv) => (inv.id === id ? updated : inv)),
    }))
  },

  voidInvoice: async (id) => {
    const updated = await invoicesApi.void(id)
    set((state) => ({
      invoices: state.invoices.map((inv) => (inv.id === id ? updated : inv)),
    }))
  },

  createInvoice: async (data) => {
    const invoice = await invoicesApi.create(data)
    get().fetchInvoices()
    return invoice
  },
}))

export function useFilteredInvoices() {
  const invoices = useInvoiceStore((s) => s.invoices)
  const totalCount = useInvoiceStore((s) => s.totalCount)
  const totalPages = useInvoiceStore((s) => s.totalPages)
  const page = useInvoiceStore((s) => s.page)

  return { invoices, totalCount, totalPages, page }
}

export function useInvoicesForContact(contactId: string) {
  const invoices = useInvoiceStore((s) => s.invoices)
  return invoices.filter((i) => i.contact_id === contactId)
}

export function useOverdueInvoices() {
  const invoices = useInvoiceStore((s) => s.invoices)
  return invoices.filter((i) => i.status === 'past_due')
}

export function useOverdueTotal() {
  const overdue = useOverdueInvoices()
  return overdue.reduce((sum, i) => sum + i.total, 0)
}

export default useInvoiceStore
