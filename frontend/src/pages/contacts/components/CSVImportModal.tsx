import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Upload, FileText, Check, AlertTriangle, AlertCircle, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import useContactStore from '@/stores/contactStore'
import usePipelineStore from '@/stores/pipelineStore'
import { LEAD_SOURCE_LABELS } from '@/types/contact'
import type { LeadSource } from '@/types/contact'
import {
  parseCSV,
  mapColumns,
  scrubRows,
  validateRow,
  findDuplicates,
  generateFailedCSV,
  buildContact,
  CRM_FIELDS,
  type ColumnMapping,
  type ScrubResult,
  type ImportOptions,
} from '@/lib/csvImport'

type Step = 'upload' | 'mapping' | 'scrubbing' | 'preview' | 'options' | 'importing'

const STEPS: Step[] = ['upload', 'mapping', 'scrubbing', 'preview', 'options', 'importing']

const STEP_LABELS: Record<Step, string> = {
  upload: 'Upload CSV',
  mapping: 'Map Fields',
  scrubbing: 'Data Scrubbing',
  preview: 'Preview & Edit',
  options: 'Import Options',
  importing: 'Import',
}

const PAGE_SIZE = 25

interface CSVImportModalProps {
  onClose: () => void
}

export default function CSVImportModal({ onClose }: CSVImportModalProps) {
  const contacts = useContactStore((s) => s.contacts)
  const addContacts = useContactStore((s) => s.addContacts)
  const updateContact = useContactStore((s) => s.updateContact)
  const stages = usePipelineStore((s) => s.stages)

  // Step state
  const [step, setStep] = useState<Step>('upload')

  // Upload state
  const [fileName, setFileName] = useState('')
  const [rawHeaders, setRawHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<string[][]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mapping state
  const [mappings, setMappings] = useState<ColumnMapping[]>([])

  // Scrubbing state
  const [scrubbedRows, setScrubbedRows] = useState<ScrubResult[]>([])

  // Preview state
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [duplicateMap, setDuplicateMap] = useState<Map<number, ReturnType<typeof findDuplicates> extends Map<number, infer V> ? V : never>>(new Map())
  const [previewFilter, setPreviewFilter] = useState<'all' | 'warnings' | 'errors' | 'duplicates'>('all')
  const [previewPage, setPreviewPage] = useState(0)
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null)

  // Options state
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    duplicateAction: 'skip',
    leadSourceOverride: null,
    assignedToOverride: null,
    autoCreateDeals: false,
    defaultStageId: stages[0]?.id ?? '',
    defaultDealValue: 0,
  })

  // Import state
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<{
    imported: number
    updated: number
    skipped: number
    failed: number
    failedRows: { row: string[]; reason: string }[]
  } | null>(null)

  // --- File handling ---

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) return
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers, rows } = parseCSV(text)
      setRawHeaders(headers)
      setRawRows(rows)
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  // --- Step navigation ---

  const stepIndex = STEPS.indexOf(step)

  const goNext = () => {
    const next = STEPS[stepIndex + 1]
    if (!next) return

    if (step === 'upload') {
      const sampleRows = rawRows.slice(0, 20)
      setMappings(mapColumns(rawHeaders, sampleRows))
    }

    if (step === 'mapping') {
      const results = scrubRows(rawRows, mappings)
      // Run validation and merge errors
      results.forEach((row) => {
        const validation = validateRow(row)
        if (!validation.valid) {
          row.errors.push(...validation.errors)
          row.status = 'error'
        }
      })
      setScrubbedRows(results)
    }

    if (step === 'scrubbing') {
      const dupes = findDuplicates(scrubbedRows, contacts)
      setDuplicateMap(dupes)
      // Select all clean/warning rows, deselect errors
      const selected = new Set<number>()
      scrubbedRows.forEach((row, idx) => {
        if (row.status !== 'error') selected.add(idx)
      })
      setSelectedRows(selected)
      setPreviewPage(0)
    }

    if (step === 'options') {
      runImport()
    }

    setStep(next)
  }

  const goBack = () => {
    const prev = STEPS[stepIndex - 1]
    if (prev) setStep(prev)
  }

  // --- Import execution ---

  const runImport = () => {
    const selected = Array.from(selectedRows).sort((a, b) => a - b)
    let imported = 0
    let updated = 0
    let skipped = 0
    let failed = 0
    const failedRows: { row: string[]; reason: string }[] = []

    const batchSize = 5
    const totalBatches = Math.ceil(selected.length / batchSize)
    let batchIdx = 0

    const processBatch = () => {
      const start = batchIdx * batchSize
      const batch = selected.slice(start, start + batchSize)

      const toAdd: ReturnType<typeof buildContact>[] = []

      for (const rowIdx of batch) {
        const row = scrubbedRows[rowIdx]
        if (!row) {
          failed++
          continue
        }

        const isDuplicate = duplicateMap.has(rowIdx)

        if (isDuplicate) {
          const existing = duplicateMap.get(rowIdx)!
          switch (importOptions.duplicateAction) {
            case 'skip':
              skipped++
              continue
            case 'update':
              try {
                updateContact(existing.id, row.data)
                updated++
              } catch {
                failed++
                failedRows.push({ row: rawRows[rowIdx] ?? [], reason: 'Update failed' })
              }
              continue
            case 'create':
              // Fall through to create
              break
          }
        }

        try {
          toAdd.push(buildContact(row.data, importOptions))
          imported++
        } catch {
          failed++
          failedRows.push({ row: rawRows[rowIdx] ?? [], reason: 'Import failed' })
        }
      }

      if (toAdd.length > 0) {
        addContacts(toAdd)
      }

      batchIdx++
      setImportProgress(Math.min(Math.round((batchIdx / totalBatches) * 100), 100))

      if (batchIdx < totalBatches) {
        setTimeout(processBatch, 100)
      } else {
        setImportResult({ imported, updated, skipped, failed, failedRows })
      }
    }

    if (selected.length === 0) {
      setImportResult({ imported: 0, updated: 0, skipped: 0, failed: 0, failedRows: [] })
      setImportProgress(100)
    } else {
      processBatch()
    }
  }

  // --- Download failed ---

  const downloadFailed = () => {
    if (!importResult?.failedRows.length) return
    const csv = generateFailedCSV(rawHeaders, importResult.failedRows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'failed_imports.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // --- Preview helpers ---

  const mappedFields = mappings.filter((m) => m.crmField).map((m) => m.crmField!)
  const fieldLabels = mappedFields.map((key) => CRM_FIELDS.find((f) => f.key === key)?.label ?? key)

  const filteredIndices = scrubbedRows
    .map((_, idx) => idx)
    .filter((idx) => {
      if (previewFilter === 'all') return true
      if (previewFilter === 'warnings') return scrubbedRows[idx].status === 'warning'
      if (previewFilter === 'errors') return scrubbedRows[idx].status === 'error'
      if (previewFilter === 'duplicates') return duplicateMap.has(idx)
      return true
    })

  const totalPreviewPages = Math.max(1, Math.ceil(filteredIndices.length / PAGE_SIZE))
  const pagedIndices = filteredIndices.slice(previewPage * PAGE_SIZE, (previewPage + 1) * PAGE_SIZE)

  const counts = {
    clean: scrubbedRows.filter((r) => r.status === 'clean').length,
    warnings: scrubbedRows.filter((r) => r.status === 'warning').length,
    errors: scrubbedRows.filter((r) => r.status === 'error').length,
    duplicates: duplicateMap.size,
  }

  const selectedCount = selectedRows.size
  const readyToImport = selectedCount - (importOptions.duplicateAction === 'skip' ? [...selectedRows].filter((i) => duplicateMap.has(i)).length : 0)

  // --- Inline edit ---

  const updateScrubbedCell = (rowIdx: number, field: string, value: string) => {
    setScrubbedRows((prev) => {
      const updated = [...prev]
      updated[rowIdx] = {
        ...updated[rowIdx],
        data: { ...updated[rowIdx].data, [field]: value },
      }
      return updated
    })
    setEditingCell(null)
  }

  // --- Mapping update ---

  const updateMapping = (colIdx: number, crmField: string | null) => {
    setMappings((prev) => {
      const updated = [...prev]
      updated[colIdx] = { ...updated[colIdx], crmField, confidence: crmField ? 'high' : 'low' }
      return updated
    })
  }

  // --- Escape to close ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // --- Render helpers ---

  const canContinue = (): boolean => {
    switch (step) {
      case 'upload':
        return rawRows.length > 0
      case 'mapping':
        return mappings.some((m) => m.crmField !== null)
      case 'scrubbing':
        return true
      case 'preview':
        return selectedRows.size > 0
      case 'options':
        return true
      case 'importing':
        return false
    }
  }

  const continueLabel = (): string => {
    if (step === 'options') return `Import ${readyToImport > 0 ? readyToImport : selectedCount} Contacts`
    if (step === 'importing') return importResult ? 'Done' : 'Importing...'
    return 'Continue'
  }

  // --- Step renders ---

  function renderUpload() {
    return (
      <div className="space-y-4">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-12 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <Upload className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-heading">Drag and drop your CSV file here</p>
            <p className="mt-1 text-xs text-muted-foreground">or click to browse</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        {fileName && (
          <div className="rounded-lg border border-border bg-page/50 p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium text-heading">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {rawRows.length} rows, {rawHeaders.length} columns detected
                </p>
              </div>
              <Check className="h-5 w-5 text-success" />
            </div>
            {rawHeaders.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {rawHeaders.map((h) => (
                  <span
                    key={h}
                    className="rounded-full bg-white px-2.5 py-0.5 text-xs text-body shadow-card"
                  >
                    {h}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  function renderMapping() {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Map each CSV column to a CRM field. Low-confidence matches are highlighted.
        </p>
        <div className="rounded-lg border border-border overflow-hidden">
          {mappings.map((mapping, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0 ${
                mapping.confidence === 'low' && mapping.crmField ? 'bg-warning/5' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-heading truncate">{mapping.csvHeader}</p>
                {mapping.sampleValue && (
                  <p className="text-xs text-muted-foreground truncate">e.g. "{mapping.sampleValue}"</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {mapping.crmField && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      mapping.confidence === 'high'
                        ? 'bg-success/10 text-success'
                        : mapping.confidence === 'medium'
                          ? 'bg-info/10 text-info'
                          : 'bg-warning/10 text-warning'
                    }`}
                  >
                    {mapping.confidence}
                  </span>
                )}
                <select
                  value={mapping.crmField ?? ''}
                  onChange={(e) => updateMapping(idx, e.target.value || null)}
                  className="w-44 rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-body outline-none focus:border-primary"
                >
                  <option value="">Skip this column</option>
                  {CRM_FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderScrubbing() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Data has been cleaned and normalized. Review the summary below.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-success/20 bg-success/5 p-4 text-center">
            <p className="text-2xl font-bold text-success">{counts.clean}</p>
            <p className="text-xs font-medium text-success">Clean</p>
          </div>
          <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 text-center">
            <p className="text-2xl font-bold text-warning">{counts.warnings}</p>
            <p className="text-xs font-medium text-warning">Warnings</p>
          </div>
          <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-center">
            <p className="text-2xl font-bold text-danger">{counts.errors}</p>
            <p className="text-xs font-medium text-danger">Errors</p>
          </div>
        </div>

        {(counts.warnings > 0 || counts.errors > 0) && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-heading">Issues found:</h4>
            <div className="max-h-48 space-y-1.5 overflow-y-auto">
              {scrubbedRows
                .flatMap((row, idx) => [
                  ...row.warnings.map((w) => ({ type: 'warning' as const, msg: w, row: idx + 1 })),
                  ...row.errors.map((e) => ({ type: 'error' as const, msg: e, row: idx + 1 })),
                ])
                .slice(0, 10)
                .map((issue, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs ${
                      issue.type === 'error' ? 'bg-danger/5 text-danger' : 'bg-warning/5 text-warning'
                    }`}
                  >
                    {issue.type === 'error' ? (
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    )}
                    <span>
                      Row {issue.row}: {issue.msg}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderPreview() {
    return (
      <div className="space-y-3">
        {/* Filters */}
        <div className="flex items-center gap-2">
          {(
            [
              { key: 'all', label: `All (${scrubbedRows.length})` },
              { key: 'warnings', label: `Warnings (${counts.warnings})` },
              { key: 'errors', label: `Errors (${counts.errors})` },
              { key: 'duplicates', label: `Duplicates (${counts.duplicates})` },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => { setPreviewFilter(f.key); setPreviewPage(0) }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                previewFilter === f.key
                  ? 'bg-primary text-white'
                  : 'bg-page text-body hover:bg-border'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-page/50">
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={pagedIndices.length > 0 && pagedIndices.every((i) => selectedRows.has(i))}
                    onChange={(e) => {
                      const next = new Set(selectedRows)
                      pagedIndices.forEach((i) => {
                        if (e.target.checked) next.add(i)
                        else next.delete(i)
                      })
                      setSelectedRows(next)
                    }}
                    className="accent-primary h-3.5 w-3.5 rounded"
                  />
                </th>
                {fieldLabels.map((label) => (
                  <th key={label} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    {label}
                  </th>
                ))}
                <th className="w-20 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {pagedIndices.map((rowIdx) => {
                const row = scrubbedRows[rowIdx]
                const isDupe = duplicateMap.has(rowIdx)
                const bgClass =
                  row.status === 'error'
                    ? 'bg-danger/5'
                    : row.status === 'warning'
                      ? 'bg-warning/5'
                      : isDupe
                        ? 'bg-warning/5'
                        : ''

                return (
                  <tr key={rowIdx} className={`border-t border-border ${bgClass}`}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(rowIdx)}
                        onChange={(e) => {
                          const next = new Set(selectedRows)
                          if (e.target.checked) next.add(rowIdx)
                          else next.delete(rowIdx)
                          setSelectedRows(next)
                        }}
                        className="accent-primary h-3.5 w-3.5 rounded"
                      />
                    </td>
                    {mappedFields.map((field) => {
                      const value = row.data[field] ?? ''
                      const isEditing = editingCell?.row === rowIdx && editingCell?.field === field

                      return (
                        <td
                          key={field}
                          className="px-3 py-2 cursor-pointer"
                          onClick={() => setEditingCell({ row: rowIdx, field })}
                        >
                          {isEditing ? (
                            <input
                              autoFocus
                              defaultValue={value}
                              onBlur={(e) => updateScrubbedCell(rowIdx, field, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updateScrubbedCell(rowIdx, field, (e.target as HTMLInputElement).value)
                                }
                                if (e.key === 'Escape') setEditingCell(null)
                              }}
                              className="w-full bg-white px-1.5 py-0.5 text-sm text-heading outline-none ring-1 ring-primary rounded"
                            />
                          ) : (
                            <span className="text-body text-sm">{value || <span className="text-placeholder">--</span>}</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {row.status === 'error' && (
                          <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">Error</span>
                        )}
                        {row.status === 'warning' && (
                          <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">Warning</span>
                        )}
                        {isDupe && (
                          <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">Existing</span>
                        )}
                        {row.status === 'clean' && !isDupe && (
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">Clean</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {pagedIndices.length === 0 && (
                <tr>
                  <td colSpan={mappedFields.length + 2} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No rows match this filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPreviewPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filteredIndices.length} rows, {selectedCount} selected</span>
            <div className="flex items-center gap-2">
              <button
                disabled={previewPage === 0}
                onClick={() => setPreviewPage((p) => p - 1)}
                className="rounded p-1 hover:bg-page disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>
                Page {previewPage + 1} of {totalPreviewPages}
              </span>
              <button
                disabled={previewPage >= totalPreviewPages - 1}
                onClick={() => setPreviewPage((p) => p + 1)}
                className="rounded p-1 hover:bg-page disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderOptions() {
    return (
      <div className="space-y-6">
        {/* Duplicate handling */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-heading">Duplicate Handling</h4>
          <p className="mb-3 text-xs text-muted-foreground">
            {counts.duplicates} duplicate{counts.duplicates !== 1 ? 's' : ''} found matching existing contacts by email or phone.
          </p>
          <div className="space-y-2">
            {(
              [
                { value: 'skip', label: 'Skip duplicates', desc: 'Do not import rows that match existing contacts' },
                { value: 'update', label: 'Update existing', desc: 'Overwrite existing contact fields with CSV data' },
                { value: 'create', label: 'Create new', desc: 'Import as new contacts even if duplicates exist' },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  importOptions.duplicateAction === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <input
                  type="radio"
                  name="duplicateAction"
                  value={opt.value}
                  checked={importOptions.duplicateAction === opt.value}
                  onChange={() => setImportOptions((o) => ({ ...o, duplicateAction: opt.value }))}
                  className="accent-primary mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-heading">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Lead source override */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Lead Source</label>
            <select
              value={importOptions.leadSourceOverride ?? ''}
              onChange={(e) =>
                setImportOptions((o) => ({
                  ...o,
                  leadSourceOverride: e.target.value ? (e.target.value as LeadSource) : null,
                }))
              }
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-body outline-none focus:border-primary"
            >
              <option value="">Keep from CSV</option>
              {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Assign To Rep</label>
            <select
              value={importOptions.assignedToOverride ?? ''}
              onChange={(e) =>
                setImportOptions((o) => ({
                  ...o,
                  assignedToOverride: e.target.value || null,
                }))
              }
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-body outline-none focus:border-primary"
            >
              <option value="">Keep from CSV</option>
              <option value="Rep A">Rep A</option>
              <option value="Rep B">Rep B</option>
              <option value="Rep C">Rep C</option>
            </select>
          </div>
        </div>

        {/* Auto-create deals */}
        <div className="rounded-lg border border-border p-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={importOptions.autoCreateDeals}
              onChange={(e) => setImportOptions((o) => ({ ...o, autoCreateDeals: e.target.checked }))}
              className="accent-primary h-4 w-4 rounded"
            />
            <span className="text-sm font-medium text-heading">Auto-create deals for imported contacts</span>
          </label>
          {importOptions.autoCreateDeals && (
            <div className="mt-3 grid grid-cols-2 gap-4 pl-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Pipeline Stage</label>
                <select
                  value={importOptions.defaultStageId}
                  onChange={(e) => setImportOptions((o) => ({ ...o, defaultStageId: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-body outline-none focus:border-primary"
                >
                  {stages
                    .filter((s) => !s.is_lost)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Default Deal Value</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={importOptions.defaultDealValue}
                    onChange={(e) =>
                      setImportOptions((o) => ({ ...o, defaultDealValue: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full rounded-lg border border-border bg-white pl-7 pr-3 py-2 text-sm text-heading outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="rounded-lg bg-primary/5 p-4 text-center">
          <p className="text-lg font-bold text-primary">
            Ready to import {readyToImport > 0 ? readyToImport : selectedCount} contacts
          </p>
          <p className="text-xs text-muted-foreground">
            {selectedCount} selected, {counts.duplicates} duplicates ({importOptions.duplicateAction})
          </p>
        </div>
      </div>
    )
  }

  function renderImporting() {
    if (!importResult) {
      return (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="w-full max-w-md">
            <div className="h-2 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Processing... {importProgress}%
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-4 py-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <Check className="h-6 w-6 text-success" />
          </div>
          <h3 className="text-lg font-semibold text-heading">Import Complete</h3>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-success/20 bg-success/5 p-3 text-center">
            <p className="text-xl font-bold text-success">{importResult.imported}</p>
            <p className="text-xs text-success">Imported</p>
          </div>
          <div className="rounded-lg border border-info/20 bg-info/5 p-3 text-center">
            <p className="text-xl font-bold text-info">{importResult.updated}</p>
            <p className="text-xs text-info">Updated</p>
          </div>
          <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 text-center">
            <p className="text-xl font-bold text-warning">{importResult.skipped}</p>
            <p className="text-xs text-warning">Skipped</p>
          </div>
          <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-center">
            <p className="text-xl font-bold text-danger">{importResult.failed}</p>
            <p className="text-xs text-danger">Failed</p>
          </div>
        </div>

        {importResult.failedRows.length > 0 && (
          <div className="text-center">
            <button
              onClick={downloadFailed}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-body hover:bg-page"
            >
              <Download className="h-4 w-4" />
              Download Failed Rows
            </button>
          </div>
        )}
      </div>
    )
  }

  // --- Main render ---

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 top-[3%] bottom-[3%] z-50 mx-auto w-full max-w-4xl overflow-y-auto">
        <div className="mx-4 flex min-h-full flex-col rounded-2xl bg-white shadow-modal">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-6 py-4 rounded-t-2xl">
            <h3 className="text-lg font-semibold text-heading">{STEP_LABELS[step]}</h3>
            <div className="flex items-center gap-4">
              {/* Step dots */}
              <div className="hidden items-center gap-1.5 sm:flex">
                {STEPS.map((s, i) => (
                  <div
                    key={s}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      i < stepIndex
                        ? 'bg-success'
                        : i === stepIndex
                          ? 'bg-primary'
                          : 'border border-border bg-white'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-muted-foreground hover:bg-page hover:text-body"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 p-6">
            {step === 'upload' && renderUpload()}
            {step === 'mapping' && renderMapping()}
            {step === 'scrubbing' && renderScrubbing()}
            {step === 'preview' && renderPreview()}
            {step === 'options' && renderOptions()}
            {step === 'importing' && renderImporting()}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex items-center justify-between border-t border-border bg-white px-6 py-4 rounded-b-2xl">
            <div>
              {stepIndex > 0 && step !== 'importing' && (
                <button
                  onClick={goBack}
                  className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              )}
            </div>
            <div>
              {step === 'importing' && importResult ? (
                <button
                  onClick={onClose}
                  className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary-hover"
                >
                  Done
                </button>
              ) : step !== 'importing' ? (
                <button
                  onClick={goNext}
                  disabled={!canContinue()}
                  className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {continueLabel()}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
