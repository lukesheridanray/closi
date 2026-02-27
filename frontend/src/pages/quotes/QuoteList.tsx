import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Search, Plus, ChevronDown } from 'lucide-react'
import useQuoteStore, { useFilteredQuotes } from '@/stores/quoteStore'
import useContactStore from '@/stores/contactStore'
import type { Quote, QuoteStatus } from '@/types/quote'
import { QUOTE_STATUS_LABELS } from '@/types/quote'
import DataTable, { type Column } from '@/components/shared/DataTable'
import SlideOutPanel from '@/components/layout/SlideOutPanel'
import QuoteDetailPanel from './components/QuoteDetailPanel'
import QuoteBuilder from './components/QuoteBuilder'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-info/10 text-info',
  accepted: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
  expired: 'bg-warning/10 text-warning',
}

const statusOptions: { value: QuoteStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  ...Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => ({
    value: value as QuoteStatus,
    label,
  })),
]

export default function QuoteList() {
  const selectedQuoteId = useQuoteStore((s) => s.selectedQuoteId)
  const allQuotes = useQuoteStore((s) => s.quotes)
  const loading = useQuoteStore((s) => s.loading)
  const fetchQuotes = useQuoteStore((s) => s.fetchQuotes)
  const search = useQuoteStore((s) => s.search)
  const statusFilter = useQuoteStore((s) => s.statusFilter)
  const sortField = useQuoteStore((s) => s.sortField)
  const sortDir = useQuoteStore((s) => s.sortDir)
  const selectQuote = useQuoteStore((s) => s.selectQuote)
  const setSearch = useQuoteStore((s) => s.setSearch)
  const setStatusFilter = useQuoteStore((s) => s.setStatusFilter)
  const setSort = useQuoteStore((s) => s.setSort)

  const contacts = useContactStore((s) => s.contacts)
  const fetchContacts = useContactStore((s) => s.fetchContacts)
  const contactMap = new Map(contacts.map((c) => [c.id, c]))

  useEffect(() => { fetchQuotes() }, [fetchQuotes])
  useEffect(() => { fetchContacts() }, [fetchContacts])

  const quotes = useFilteredQuotes()
  const [showBuilder, setShowBuilder] = useState(false)

  const selectedQuote = selectedQuoteId
    ? allQuotes.find((q) => q.id === selectedQuoteId)
    : null

  const columns: Column<Quote>[] = [
    {
      key: 'title',
      label: 'Quote',
      sortable: true,
      render: (q) => {
        const contact = contactMap.get(q.contact_id)
        return (
          <div>
            <p className="font-medium text-heading">{q.title}</p>
            {contact && (
              <p className="text-xs text-muted-foreground">{contact.first_name} {contact.last_name}</p>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (q) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[q.status]}`}>
          {QUOTE_STATUS_LABELS[q.status]}
        </span>
      ),
    },
    {
      key: 'equipment_total',
      label: 'Equipment',
      sortable: true,
      className: 'hidden md:table-cell',
      render: (q) => (
        <span className="text-body">{currencyFormat.format(q.equipment_total)}</span>
      ),
    },
    {
      key: 'monitoring',
      label: 'Monthly',
      className: 'hidden md:table-cell',
      render: (q) => (
        <span className="text-body">${q.monthly_monitoring_amount}/mo</span>
      ),
    },
    {
      key: 'total',
      label: 'Total Value',
      className: 'hidden lg:table-cell',
      render: (q) => (
        <span className="font-bold text-primary">{currencyFormat.format(q.total_contract_value)}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      className: 'hidden xl:table-cell',
      render: (q) => (
        <span className="text-muted-foreground">
          {format(new Date(q.created_at), 'MMM d, yyyy')}
        </span>
      ),
    },
  ]

  if (loading && allQuotes.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading quotes...</div>
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quotes..."
            className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-heading shadow-card outline-none placeholder:text-placeholder focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as QuoteStatus | 'all')}
            className="appearance-none rounded-lg border border-border bg-white py-2 pl-3 pr-8 text-sm text-body shadow-card outline-none focus:border-primary"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        <button
          onClick={() => setShowBuilder(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-card transition-colors hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          Create Quote
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        {quotes.length} quote{quotes.length !== 1 ? 's' : ''}
      </p>

      <DataTable<Quote>
        columns={columns}
        data={quotes}
        rowKey={(q) => q.id}
        onRowClick={(q) => selectQuote(q.id)}
        sortField={sortField}
        sortDir={sortDir}
        onSort={setSort}
        emptyMessage="No quotes match your search"
      />

      <SlideOutPanel
        open={!!selectedQuote}
        onClose={() => selectQuote(null)}
        title={selectedQuote?.title ?? 'Quote Details'}
        width="md"
      >
        {selectedQuote && <QuoteDetailPanel quote={selectedQuote} />}
      </SlideOutPanel>

      {showBuilder && <QuoteBuilder onClose={() => setShowBuilder(false)} />}
    </div>
  )
}
