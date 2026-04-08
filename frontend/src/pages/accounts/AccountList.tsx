import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, Search, Plus, ChevronDown, Upload } from 'lucide-react'
import useContactStore, { useFilteredContacts } from '@/stores/contactStore'
import type { Contact, LeadSource, ContactStatus } from '@/types/contact'
import { LEAD_SOURCE_LABELS, CONTACT_STATUS_LABELS } from '@/types/contact'
import DataTable, { type Column } from '@/components/shared/DataTable'
import CSVImportModal from '@/pages/contacts/components/CSVImportModal'
import CreateContactModal from '@/pages/contacts/components/CreateContactModal'

const sourceOptions: { value: LeadSource | 'all'; label: string }[] = [
  { value: 'all', label: 'All Sources' },
  ...Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => ({
    value: value as LeadSource,
    label,
  })),
]

const statusOptions: { value: ContactStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  ...Object.entries(CONTACT_STATUS_LABELS).map(([value, label]) => ({
    value: value as ContactStatus,
    label,
  })),
]

const statusColors: Record<string, string> = {
  new: 'bg-info/10 text-info',
  active: 'bg-success/10 text-success',
  customer: 'bg-primary/10 text-primary',
  inactive: 'bg-muted text-muted-foreground',
  lost: 'bg-danger/10 text-danger',
}

const columns: Column<Contact>[] = [
  {
    key: 'name',
    label: 'Name',
    sortable: true,
    render: (c) => (
      <div className="flex items-center gap-1.5">
        <div>
          <p className="font-medium text-heading">
            {c.first_name} {c.last_name}
          </p>
          {c.company && (
            <p className="text-xs text-muted-foreground">{c.company}</p>
          )}
        </div>
        {c.status === 'customer' && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-primary" title="Customer">
            <DollarSign className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
    ),
  },
  {
    key: 'email',
    label: 'Email',
    sortable: true,
    className: 'hidden md:table-cell',
    render: (c) => <span className="text-body">{c.email}</span>,
  },
  {
    key: 'phone',
    label: 'Phone',
    className: 'hidden lg:table-cell',
    render: (c) => <span className="text-body">{c.phone}</span>,
  },
  {
    key: 'source',
    label: 'Source',
    sortable: true,
    className: 'hidden md:table-cell',
    render: (c) => (
      <span className="text-body">{LEAD_SOURCE_LABELS[c.lead_source]}</span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (c) => (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
          statusColors[c.status] ?? statusColors.active
        }`}
      >
        {CONTACT_STATUS_LABELS[c.status]}
      </span>
    ),
  },
  {
    key: 'created_at',
    label: 'Created',
    sortable: true,
    className: 'hidden xl:table-cell',
    render: (c) => (
      <span className="text-muted-foreground">
        {new Date(c.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </span>
    ),
  },
]

export default function AccountList() {
  const navigate = useNavigate()
  const [showImport, setShowImport] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const allContacts = useContactStore((s) => s.contacts)
  const loading = useContactStore((s) => s.loading)
  const fetchContacts = useContactStore((s) => s.fetchContacts)
  const search = useContactStore((s) => s.search)
  const sourceFilter = useContactStore((s) => s.sourceFilter)
  const statusFilter = useContactStore((s) => s.statusFilter)
  const sortField = useContactStore((s) => s.sortField)
  const sortDir = useContactStore((s) => s.sortDir)
  const setSearch = useContactStore((s) => s.setSearch)
  const setSourceFilter = useContactStore((s) => s.setSourceFilter)
  const setStatusFilter = useContactStore((s) => s.setStatusFilter)
  const setSort = useContactStore((s) => s.setSort)
  const setPage = useContactStore((s) => s.setPage)

  useEffect(() => { fetchContacts() }, [fetchContacts])

  const { contacts, totalCount, totalPages, page } = useFilteredContacts()

  if (loading && allContacts.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading accounts...</div>
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
            placeholder="Search accounts..."
            className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-heading shadow-card outline-none placeholder:text-placeholder focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
        </div>

        <div className="relative">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as LeadSource | 'all')}
            className="appearance-none rounded-lg border border-border bg-white py-2 pl-3 pr-8 text-sm text-body shadow-card outline-none focus:border-primary"
          >
            {sourceOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ContactStatus | 'all')}
            className="appearance-none rounded-lg border border-border bg-white py-2 pl-3 pr-8 text-sm text-body shadow-card outline-none focus:border-primary"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-body shadow-card transition-colors hover:bg-page"
        >
          <Upload className="h-4 w-4" />
          Import
        </button>

        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-card transition-colors hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          Add Lead
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        {totalCount} account{totalCount !== 1 ? 's' : ''}
      </p>

      <DataTable<Contact>
        columns={columns}
        data={contacts}
        rowKey={(c) => c.id}
        onRowClick={(c) => navigate(`/accounts/${c.id}`)}
        sortField={sortField}
        sortDir={sortDir}
        onSort={setSort}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
        emptyMessage="No accounts match your search"
      />

      {showImport && <CSVImportModal onClose={() => setShowImport(false)} />}
      <CreateContactModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
