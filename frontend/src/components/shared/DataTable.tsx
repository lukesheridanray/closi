import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

// --- Column Definition ---

export interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  className?: string
  render: (row: T) => React.ReactNode
}

// --- Props ---

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  sortField?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (field: string) => void
  page?: number
  totalPages?: number
  totalCount?: number
  onPageChange?: (page: number) => void
  emptyMessage?: string
}

export default function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  sortField,
  sortDir,
  onSort,
  page = 1,
  totalPages = 1,
  totalCount = 0,
  onPageChange,
  emptyMessage = 'No results found',
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-page/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground ${
                    col.sortable ? 'cursor-pointer select-none hover:text-heading' : ''
                  } ${col.className ?? ''}`}
                  onClick={() => col.sortable && onSort?.(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortField === col.key && (
                      sortDir === 'asc'
                        ? <ChevronUp className="h-3.5 w-3.5" />
                        : <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-border transition-colors last:border-b-0 ${
                    onRowClick ? 'cursor-pointer hover:bg-page/60' : ''
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-sm ${col.className ?? ''}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * 10 + 1}-{Math.min(page * 10, totalCount)} of {totalCount}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-page hover:text-body disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => onPageChange?.(p)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                  p === page
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:bg-page hover:text-body'
                }`}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-page hover:text-body disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
