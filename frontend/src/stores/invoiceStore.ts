import { create } from 'zustand'
import { differenceInDays } from 'date-fns'
import type { Invoice, InvoiceStatus, InvoiceType, InvoiceLine } from '@/types/invoice'
import useContractStore from './contractStore'
import useContactStore from './contactStore'

interface InvoiceState {
  invoices: Invoice[]
  selectedInvoiceId: string | null
  search: string
  statusFilter: InvoiceStatus | 'all'
  page: number
  pageSize: number

  selectInvoice: (id: string | null) => void
  setSearch: (q: string) => void
  setStatusFilter: (status: InvoiceStatus | 'all') => void
  setPage: (page: number) => void
  sendInvoice: (id: string) => void
  markPaid: (id: string) => void
  voidInvoice: (id: string) => void
  createInvoice: (data: {
    contract_id: string
    contact_id: string
    type: InvoiceType
    line_items: InvoiceLine[]
    tax_rate: number
    due_date: string
    notes?: string
  }) => void
}

const ORG_ID = 'org_01'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function dateStr(daysOffset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  return d.toISOString().split('T')[0]
}

// Generate mock invoices from existing contracts
const mockInvoices: Invoice[] = [
  // Wilson contract - equipment install invoice (paid)
  {
    id: 'inv_01',
    org_id: ORG_ID,
    contract_id: 'contract_01',
    contact_id: 'contact_01',
    invoice_number: 'INV-2026-001',
    type: 'one_time',
    status: 'paid',
    line_items: [
      { description: 'Control Panel - Smart Hub Pro', quantity: 1, unit_price: 450, total: 450 },
      { description: 'Outdoor Camera - 2K Night Vision', quantity: 4, unit_price: 299, total: 1196 },
      { description: 'Doorbell Camera - HD', quantity: 1, unit_price: 199, total: 199 },
      { description: 'Motion Sensor - Indoor', quantity: 6, unit_price: 45, total: 270 },
      { description: 'Door/Window Sensor', quantity: 8, unit_price: 25, total: 200 },
      { description: 'Professional Installation', quantity: 1, unit_price: 85, total: 85 },
    ],
    subtotal: 2400,
    tax_rate: 0.0825,
    tax_amount: 198,
    total: 2598,
    due_date: dateStr(-60),
    sent_at: daysAgo(65),
    paid_at: daysAgo(60),
    voided_at: null,
    notes: 'Equipment installation for Wilson Home Security System',
    created_at: daysAgo(68),
    updated_at: daysAgo(60),
  },
  // Wilson contract - recurring monitoring (paid, last month)
  {
    id: 'inv_02',
    org_id: ORG_ID,
    contract_id: 'contract_01',
    contact_id: 'contact_01',
    invoice_number: 'INV-2026-002',
    type: 'recurring',
    status: 'paid',
    line_items: [
      { description: 'Monthly Security Monitoring - Pro Plan', quantity: 1, unit_price: 59.99, total: 59.99 },
    ],
    subtotal: 59.99,
    tax_rate: 0.0825,
    tax_amount: 4.95,
    total: 64.94,
    due_date: dateStr(-30),
    sent_at: daysAgo(35),
    paid_at: daysAgo(30),
    voided_at: null,
    notes: null,
    created_at: daysAgo(35),
    updated_at: daysAgo(30),
  },
  // Wilson contract - recurring monitoring (sent, current month)
  {
    id: 'inv_03',
    org_id: ORG_ID,
    contract_id: 'contract_01',
    contact_id: 'contact_01',
    invoice_number: 'INV-2026-003',
    type: 'recurring',
    status: 'sent',
    line_items: [
      { description: 'Monthly Security Monitoring - Pro Plan', quantity: 1, unit_price: 59.99, total: 59.99 },
    ],
    subtotal: 59.99,
    tax_rate: 0.0825,
    tax_amount: 4.95,
    total: 64.94,
    due_date: dateStr(5),
    sent_at: daysAgo(3),
    paid_at: null,
    voided_at: null,
    notes: null,
    created_at: daysAgo(5),
    updated_at: daysAgo(3),
  },
  // Foster contract - equipment install (paid)
  {
    id: 'inv_04',
    org_id: ORG_ID,
    contract_id: 'contract_02',
    contact_id: 'contact_14',
    invoice_number: 'INV-2026-004',
    type: 'one_time',
    status: 'paid',
    line_items: [
      { description: 'Control Panel - Standard', quantity: 1, unit_price: 350, total: 350 },
      { description: 'Outdoor Camera - 1080p', quantity: 2, unit_price: 199, total: 398 },
      { description: 'Motion Sensor - Indoor', quantity: 4, unit_price: 45, total: 180 },
      { description: 'Professional Installation', quantity: 1, unit_price: 85, total: 85 },
    ],
    subtotal: 1013,
    tax_rate: 0.0825,
    tax_amount: 83.57,
    total: 1096.57,
    due_date: dateStr(-110),
    sent_at: daysAgo(118),
    paid_at: daysAgo(110),
    voided_at: null,
    notes: 'Equipment installation for Foster Home Monitoring',
    created_at: daysAgo(120),
    updated_at: daysAgo(110),
  },
  // Foster - recurring (overdue)
  {
    id: 'inv_05',
    org_id: ORG_ID,
    contract_id: 'contract_02',
    contact_id: 'contact_14',
    invoice_number: 'INV-2026-005',
    type: 'recurring',
    status: 'overdue',
    line_items: [
      { description: 'Monthly Security Monitoring - Standard Plan', quantity: 1, unit_price: 39.99, total: 39.99 },
    ],
    subtotal: 39.99,
    tax_rate: 0.0825,
    tax_amount: 3.30,
    total: 43.29,
    due_date: dateStr(-8),
    sent_at: daysAgo(12),
    paid_at: null,
    voided_at: null,
    notes: null,
    created_at: daysAgo(15),
    updated_at: daysAgo(8),
  },
  // Draft invoice
  {
    id: 'inv_06',
    org_id: ORG_ID,
    contract_id: 'contract_01',
    contact_id: 'contact_01',
    invoice_number: 'INV-2026-006',
    type: 'recurring',
    status: 'draft',
    line_items: [
      { description: 'Monthly Security Monitoring - Pro Plan', quantity: 1, unit_price: 59.99, total: 59.99 },
    ],
    subtotal: 59.99,
    tax_rate: 0.0825,
    tax_amount: 4.95,
    total: 64.94,
    due_date: dateStr(35),
    sent_at: null,
    paid_at: null,
    voided_at: null,
    notes: 'Next month monitoring invoice',
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
  },
]

let invoiceCounter = 7

const useInvoiceStore = create<InvoiceState>((set) => ({
  invoices: mockInvoices,
  selectedInvoiceId: null,
  search: '',
  statusFilter: 'all',
  page: 1,
  pageSize: 10,

  selectInvoice: (id) => set({ selectedInvoiceId: id }),
  setSearch: (q) => set({ search: q, page: 1 }),
  setStatusFilter: (status) => set({ statusFilter: status, page: 1 }),
  setPage: (page) => set({ page }),

  sendInvoice: (id) =>
    set((state) => ({
      invoices: state.invoices.map((inv) =>
        inv.id === id && inv.status === 'draft'
          ? { ...inv, status: 'sent' as const, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          : inv,
      ),
    })),

  markPaid: (id) =>
    set((state) => {
      const invoice = state.invoices.find((i) => i.id === id)
      if (!invoice || invoice.status === 'paid' || invoice.status === 'cancelled') return state

      const now = new Date().toISOString()

      // Log activity on contact timeline
      const contacts = useContactStore.getState().contacts
      const contact = contacts.find((c) => c.id === invoice.contact_id)
      if (contact) {
        useContactStore.getState().addActivity({
          contact_id: invoice.contact_id,
          deal_id: null,
          type: 'note',
          subject: `Payment received: ${invoice.invoice_number}`,
          description: `Invoice ${invoice.invoice_number} marked as paid. Amount: $${invoice.total.toFixed(2)}.`,
          performed_by: 'You',
          performed_at: now,
        })
      }

      return {
        invoices: state.invoices.map((inv) =>
          inv.id === id
            ? { ...inv, status: 'paid' as const, paid_at: now, updated_at: now }
            : inv,
        ),
      }
    }),

  voidInvoice: (id) =>
    set((state) => ({
      invoices: state.invoices.map((inv) =>
        inv.id === id && inv.status !== 'paid'
          ? { ...inv, status: 'cancelled' as const, voided_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          : inv,
      ),
    })),

  createInvoice: (data) =>
    set((state) => {
      const subtotal = data.line_items.reduce((sum, li) => sum + li.total, 0)
      const taxAmount = Math.round(subtotal * data.tax_rate * 100) / 100
      const total = subtotal + taxAmount

      const num = String(invoiceCounter++).padStart(3, '0')
      const newInvoice: Invoice = {
        id: `inv_${Date.now()}`,
        org_id: ORG_ID,
        contract_id: data.contract_id,
        contact_id: data.contact_id,
        invoice_number: `INV-2026-${num}`,
        type: data.type,
        status: 'draft',
        line_items: data.line_items,
        subtotal,
        tax_rate: data.tax_rate,
        tax_amount: taxAmount,
        total,
        due_date: data.due_date,
        sent_at: null,
        paid_at: null,
        voided_at: null,
        notes: data.notes ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      return { invoices: [newInvoice, ...state.invoices] }
    }),
}))

export function useFilteredInvoices() {
  const invoices = useInvoiceStore((s) => s.invoices)
  const search = useInvoiceStore((s) => s.search)
  const statusFilter = useInvoiceStore((s) => s.statusFilter)
  const page = useInvoiceStore((s) => s.page)
  const pageSize = useInvoiceStore((s) => s.pageSize)
  const contacts = useContactStore((s) => s.contacts)

  const contactMap = new Map(contacts.map((c) => [c.id, c]))
  const q = search.toLowerCase()

  let filtered = invoices.filter((inv) => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false
    if (q) {
      const contact = contactMap.get(inv.contact_id)
      const contactName = contact ? `${contact.first_name} ${contact.last_name}`.toLowerCase() : ''
      if (
        !inv.invoice_number.toLowerCase().includes(q) &&
        !contactName.includes(q)
      ) return false
    }
    return true
  })

  filtered = [...filtered].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  const totalCount = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  return { invoices: paginated, totalCount, totalPages, page }
}

export function useInvoicesForContact(contactId: string) {
  const invoices = useInvoiceStore((s) => s.invoices)
  return invoices.filter((i) => i.contact_id === contactId)
}

export function useOverdueInvoices() {
  const invoices = useInvoiceStore((s) => s.invoices)
  return invoices.filter((i) => i.status === 'overdue')
}

export function useOverdueTotal() {
  const overdue = useOverdueInvoices()
  return overdue.reduce((sum, i) => sum + i.total, 0)
}

export default useInvoiceStore
