import { ChevronRight, ChevronUp, ChevronDown, Plus } from 'lucide-react'
import type { DealWithContact, PipelineStage } from '@/types/pipeline'
import DealTableRow from './DealTableRow'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export type SortField = 'title' | 'contact' | 'assigned_to' | 'value' | 'daysInStage' | 'expected_close_date'
export type SortDir = 'asc' | 'desc'

interface StageTableSectionProps {
  stage: PipelineStage
  deals: DealWithContact[]
  allStages: PipelineStage[]
  collapsed: boolean
  onToggleCollapse: () => void
  selectedDeals: Set<string>
  onToggleSelect: (dealId: string) => void
  onSelectAll: (stageId: string, dealIds: string[]) => void
  onDealClick: (dealId: string) => void
  onMoveDeal: (dealId: string, toStageId: string) => void
  sortField: SortField | null
  sortDir: SortDir
  onSort: (field: SortField) => void
}

const columns: { field: SortField; label: string; align?: 'right' }[] = [
  { field: 'title', label: 'Deal' },
  { field: 'contact', label: 'Contact' },
  { field: 'assigned_to', label: 'Owner' },
  { field: 'value', label: 'Value', align: 'right' },
  { field: 'daysInStage', label: 'Days' },
  { field: 'expected_close_date', label: 'Close Date' },
]

export default function StageTableSection({
  stage,
  deals,
  allStages,
  collapsed,
  onToggleCollapse,
  selectedDeals,
  onToggleSelect,
  onSelectAll,
  onDealClick,
  onMoveDeal,
  sortField,
  sortDir,
  onSort,
}: StageTableSectionProps) {
  const totalValue = deals.reduce((sum, d) => sum + d.value, 0)
  const isDimmed = stage.is_won || stage.is_lost
  const dealIds = deals.map((d) => d.id)
  const allSelected = deals.length > 0 && dealIds.every((id) => selectedDeals.has(id))

  return (
    <div
      className={`rounded-xl border border-border bg-white shadow-card overflow-hidden ${
        isDimmed ? 'opacity-75' : ''
      }`}
      style={{ borderLeftWidth: '4px', borderLeftColor: stage.color }}
    >
      {/* Collapsible header */}
      <button
        onClick={onToggleCollapse}
        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-page/40 transition-colors"
      >
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            !collapsed ? 'rotate-90' : ''
          }`}
        />
        <span
          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: stage.color }}
        />
        <h3 className="text-sm font-semibold text-heading">{stage.name}</h3>
        <span className="rounded-full bg-page px-2 py-0.5 text-xs font-medium text-muted-foreground flex-shrink-0">
          {deals.length} {deals.length === 1 ? 'deal' : 'deals'}
        </span>
        <span className="ml-auto text-sm font-medium text-muted-foreground flex-shrink-0">
          {currencyFormat.format(totalValue)}
        </span>
      </button>

      {/* Expanded content */}
      {!collapsed && (
        <>
          <table className="w-full">
            <thead>
              <tr className="border-t border-border bg-page/30">
                {/* Select-all checkbox */}
                <th className="px-3 py-2 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => onSelectAll(stage.id, dealIds)}
                    className="accent-primary h-4 w-4 rounded"
                  />
                </th>
                {columns.map((col) => (
                  <th
                    key={col.field}
                    onClick={() => onSort(col.field)}
                    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-heading transition-colors ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortField === col.field && (
                        sortDir === 'asc'
                          ? <ChevronUp className="h-3 w-3" />
                          : <ChevronDown className="h-3 w-3" />
                      )}
                    </span>
                  </th>
                ))}
                {/* Stage column header */}
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-left">
                  Stage
                </th>
              </tr>
            </thead>
            <tbody>
              {deals.length > 0 ? (
                deals.map((deal) => (
                  <DealTableRow
                    key={deal.id}
                    deal={deal}
                    allStages={allStages}
                    isSelected={selectedDeals.has(deal.id)}
                    onToggleSelect={onToggleSelect}
                    onClick={() => onDealClick(deal.id)}
                    onMoveDeal={onMoveDeal}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-sm italic text-muted-foreground">
                    No deals in this stage
                  </td>
                </tr>
              )}
            </tbody>
            {/* Sum row */}
            {deals.length > 0 && (
              <tfoot>
                <tr className="border-t border-border bg-page/20">
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-xs font-semibold text-muted-foreground" colSpan={3}>
                    {deals.length} {deals.length === 1 ? 'deal' : 'deals'}
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-bold text-heading">
                    {currencyFormat.format(totalValue)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>

          {/* Add deal stub */}
          <div className="border-t border-border px-4 py-2">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-heading transition-colors">
              <Plus className="h-4 w-4" />
              Add deal
            </button>
          </div>
        </>
      )}
    </div>
  )
}
