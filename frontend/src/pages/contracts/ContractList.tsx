import { format, differenceInDays } from 'date-fns'
import { Search, ChevronDown } from 'lucide-react'
import useContractStore, { useFilteredContracts } from '@/stores/contractStore'
import useContactStore from '@/stores/contactStore'
import type { Contract, ContractStatus } from '@/types/contract'
import { CONTRACT_STATUS_LABELS } from '@/types/contract'
import DataTable, { type Column } from '@/components/shared/DataTable'
import SlideOutPanel from '@/components/layout/SlideOutPanel'
import ContractDetailPanel from './components/ContractDetailPanel'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success',
  pending: 'bg-warning/10 text-warning',
  expired: 'bg-muted text-muted-foreground',
  cancelled: 'bg-danger/10 text-danger',
  past_due: 'bg-danger/10 text-danger',
}

const statusOptions: { value: ContractStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  ...Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => ({
    value: value as ContractStatus,
    label,
  })),
]

export default function ContractList() {
  const selectedContractId = useContractStore((s) => s.selectedContractId)
  const allContracts = useContractStore((s) => s.contracts)
  const search = useContractStore((s) => s.search)
  const statusFilter = useContractStore((s) => s.statusFilter)
  const selectContract = useContractStore((s) => s.selectContract)
  const setSearch = useContractStore((s) => s.setSearch)
  const setStatusFilter = useContractStore((s) => s.setStatusFilter)

  const contacts = useContactStore((s) => s.contacts)
  const contactMap = new Map(contacts.map((c) => [c.id, c]))

  const contracts = useFilteredContracts()

  const selectedContract = selectedContractId
    ? allContracts.find((c) => c.id === selectedContractId)
    : null

  const columns: Column<Contract>[] = [
    {
      key: 'title',
      label: 'Contract',
      render: (c) => {
        const contact = contactMap.get(c.contact_id)
        return (
          <div>
            <p className="font-medium text-heading">{c.title}</p>
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
      render: (c) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[c.status]}`}>
          {CONTRACT_STATUS_LABELS[c.status]}
        </span>
      ),
    },
    {
      key: 'monthly',
      label: 'Monthly',
      render: (c) => (
        <span className="font-bold text-primary">{currencyFormat.format(c.monthly_amount)}</span>
      ),
    },
    {
      key: 'term',
      label: 'Term',
      className: 'hidden md:table-cell',
      render: (c) => (
        <span className="text-body">{c.term_months} mo</span>
      ),
    },
    {
      key: 'renewal',
      label: 'Renewal',
      className: 'hidden lg:table-cell',
      render: (c) => {
        const daysLeft = differenceInDays(new Date(c.end_date), new Date())
        return (
          <span className={`text-sm ${daysLeft <= 90 ? 'text-warning font-medium' : 'text-body'}`}>
            {daysLeft > 0 ? `${daysLeft} days` : 'Expired'}
          </span>
        )
      },
    },
    {
      key: 'start_date',
      label: 'Start Date',
      className: 'hidden xl:table-cell',
      render: (c) => (
        <span className="text-muted-foreground">{format(new Date(c.start_date), 'MMM d, yyyy')}</span>
      ),
    },
  ]

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
            placeholder="Search contracts..."
            className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-heading shadow-card outline-none placeholder:text-placeholder focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ContractStatus | 'all')}
            className="appearance-none rounded-lg border border-border bg-white py-2 pl-3 pr-8 text-sm text-body shadow-card outline-none focus:border-primary"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {contracts.length} contract{contracts.length !== 1 ? 's' : ''}
      </p>

      <DataTable<Contract>
        columns={columns}
        data={contracts}
        rowKey={(c) => c.id}
        onRowClick={(c) => selectContract(c.id)}
        emptyMessage="No contracts match your search"
      />

      <SlideOutPanel
        open={!!selectedContract}
        onClose={() => selectContract(null)}
        title={selectedContract?.title ?? 'Contract Details'}
        width="md"
      >
        {selectedContract && <ContractDetailPanel contract={selectedContract} />}
      </SlideOutPanel>
    </div>
  )
}
