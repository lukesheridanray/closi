import { useState } from 'react'
import { format, differenceInDays } from 'date-fns'
import { Search, Plus, AlertTriangle } from 'lucide-react'
import DataTable from '@/components/shared/DataTable'
import SlideOutPanel from '@/components/layout/SlideOutPanel'
import type { Column } from '@/components/shared/DataTable'
import type { Invoice, InvoiceStatus } from '@/types/invoice'
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, INVOICE_TYPE_LABELS } from '@/types/invoice'
import useInvoiceStore, { useFilteredInvoices } from '@/stores/invoiceStore'
import useContactStore from '@/stores/contactStore'
import InvoiceDetailPanel from './components/InvoiceDetailPanel'
import CreateInvoiceModal from './components/CreateInvoiceModal'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const statusOptions: { value: InvoiceStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function InvoiceList() {
  const search = useInvoiceStore((s) => s.search)
  const statusFilter = useInvoiceStore((s) => s.statusFilter)
  const selectedInvoiceId = useInvoiceStore((s) => s.selectedInvoiceId)
  const setSearch = useInvoiceStore((s) => s.setSearch)
  const setStatusFilter = useInvoiceStore((s) => s.setStatusFilter)
  const selectInvoice = useInvoiceStore((s) => s.selectInvoice)
  const setPage = useInvoiceStore((s) => s.setPage)
  const allInvoices = useInvoiceStore((s) => s.invoices)

  const { invoices, totalCount, totalPages, page } = useFilteredInvoices()
  const contacts = useContactStore((s) => s.contacts)
  const contactMap = new Map(contacts.map((c) => [c.id, c]))

  const [showCreate, setShowCreate] = useState(false)

  const selectedInvoice = selectedInvoiceId
    ? allInvoices.find((i) => i.id === selectedInvoiceId)
    : null

  // Overdue summary
  const overdueInvoices = allInvoices.filter((i) => i.status === 'overdue')
  const overdueTotal = overdueInvoices.reduce((sum, i) => sum + i.total, 0)

  const columns: Column<Invoice>[] = [
    {
      key: 'invoice_number',
      label: 'Invoice #',
      render: (inv) => (
        <span className="font-medium text-heading">{inv.invoice_number}</span>
      ),
    },
    {
      key: 'contact',
      label: 'Customer',
      render: (inv) => {
        const c = contactMap.get(inv.contact_id)
        return c ? `${c.first_name} ${c.last_name}` : 'Unknown'
      },
    },
    {
      key: 'type',
      label: 'Type',
      render: (inv) => (
        <span className="text-xs text-muted-foreground">{INVOICE_TYPE_LABELS[inv.type]}</span>
      ),
    },
    {
      key: 'total',
      label: 'Amount',
      className: 'text-right',
      render: (inv) => (
        <span className="font-bold text-primary">{currencyFormat.format(inv.total)}</span>
      ),
    },
    {
      key: 'due_date',
      label: 'Due Date',
      render: (inv) => {
        const isOverdue = inv.status === 'overdue'
        const daysOver = isOverdue ? differenceInDays(new Date(), new Date(inv.due_date)) : 0
        return (
          <div>
            <span className={isOverdue ? 'text-danger font-medium' : ''}>
              {format(new Date(inv.due_date), 'MMM d, yyyy')}
            </span>
            {isOverdue && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-danger">
                <AlertTriangle className="h-2.5 w-2.5" />
                {daysOver}d overdue
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (inv) => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INVOICE_STATUS_COLORS[inv.status]}`}>
          {INVOICE_STATUS_LABELS[inv.status]}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Overdue alert */}
      {overdueInvoices.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 p-4">
          <AlertTriangle className="h-5 w-5 text-danger" />
          <div>
            <p className="text-sm font-semibold text-danger">
              {overdueInvoices.length} Overdue Invoice{overdueInvoices.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              Total overdue: {currencyFormat.format(overdueTotal)}
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoices..."
            className="w-full rounded-lg border border-border bg-white pl-9 pr-3 py-2 text-sm text-heading placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'all')}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-heading focus:border-primary focus:outline-none"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Invoice
        </button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={invoices}
        rowKey={(inv) => inv.id}
        onRowClick={(inv) => selectInvoice(inv.id)}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
        emptyMessage="No invoices found"
      />

      {/* Detail Panel */}
      <SlideOutPanel
        open={!!selectedInvoice}
        onClose={() => selectInvoice(null)}
        title="Invoice Details"
        width="lg"
      >
        {selectedInvoice && <InvoiceDetailPanel invoice={selectedInvoice} />}
      </SlideOutPanel>

      {/* Create Modal */}
      <CreateInvoiceModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
