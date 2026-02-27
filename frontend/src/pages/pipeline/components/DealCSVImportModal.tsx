import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Upload, FileText, Check, AlertTriangle, AlertCircle, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import usePipelineStore from '@/stores/pipelineStore'
import { useEntityLabels } from '@/hooks/useEntityLabels'
import { dealsApi, usersApi } from '@/lib/api'
import type { User } from '@/lib/api'
import { LEAD_SOURCE_LABELS } from '@/types/contact'
import type { LeadSource } from '@/types/contact'
import {
  parseCSV,
  generateFailedCSV,
  type ColumnMapping,
  type ScrubResult,
} from '@/lib/csvImport'
import {
  DEAL_CRM_FIELDS,
  CONTACT_FIELDS,
  DEAL_FIELDS,
  mapDealColumns,
  scrubDealRows,
  validateDealRow,
} from '@/lib/dealCsvImport'

type Step = 'upload' | 'mapping' | 'scrubbing' | 'preview' | 'options' | 'importing'

const STEPS: Step[] = ['upload', 'mapping', 'scrubbing', 'preview', 'options', 'importing']

const PAGE_SIZE = 25

interface DealCSVImportModalProps {
  onClose: () => void
}

export default function DealCSVImportModal({ onClose }: DealCSVImportModalProps) {
  const { deal: dealLabel } = useEntityLabels()
  const stages = usePipelineStore((s) => s.stages)
  const activePipelineId = usePipelineStore((s) => s.activePipelineId)

  const pipelineStages = stages
    .filter((s) => s.pipeline_id === activePipelineId && s.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)

  const STEP_LABELS: Record<Step, string> = {
    upload: 'Upload CSV',
    mapping: 'Map Fields',
    scrubbing: 'Data Scrubbing',
    preview: 'Preview & Edit',
    options: 'Import Options',
    importing: `Import ${dealLabel.plural}`,
  }

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
  const [previewFilter, setPreviewFilter] = useState<'all' | 'warnings' | 'errors'>('all')
  const [previewPage, setPreviewPage] = useState(0)
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null)

  // Options state
  const [stageId, setStageId] = useState(pipelineStages[0]?.id ?? '')
  const [assignedToOverride, setAssignedToOverride] = useState<string>('')
  const [leadSourceOverride, setLeadSourceOverride] = useState<string>('')
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'create'>('skip')
  const [users, setUsers] = useState<User[]>([])

  // Import state
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<{
    imported: number
    skipped: number
    failed: number
    contacts_created: number
    contacts_matched: number
    failed_rows: Array<{ row: number; reason: string }>
  } | null>(null)

  // Load users for assignment dropdown
  useEffect(() => {
    usersApi.list().then((data) => setUsers(data.items)).catch(() => {})
  }, [])

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
      setMappings(mapDealColumns(rawHeaders, sampleRows))
    }

    if (step === 'mapping') {
      const results = scrubDealRows(rawRows, mappings)
      results.forEach((row) => {
        const validation = validateDealRow(row)
        if (!validation.valid) {
          row.errors.push(...validation.errors)
          row.status = 'error'
        }
      })
      setScrubbedRows(results)
    }

    if (step === 'scrubbing') {
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

  const runImport = async () => {
    const selected = Array.from(selectedRows).sort((a, b) => a - b)
    if (selected.length === 0) {
      setImportResult({ imported: 0, skipped: 0, failed: 0, contacts_created: 0, contacts_matched: 0, failed_rows: [] })
      setImportProgress(100)
      return
    }

    setImportProgress(10)

    // Build rows for API
    const rows = selected.map((idx) => {
      const row = scrubbedRows[idx]
      return {
        first_name: row.data.first_name || undefined,
        last_name: row.data.last_name || undefined,
        email: row.data.email || undefined,
        phone: row.data.phone || undefined,
        company: row.data.company || undefined,
        address: row.data.address || undefined,
        city: row.data.city || undefined,
        state: row.data.state || undefined,
        zip: row.data.zip || undefined,
        lead_source: row.data.lead_source || undefined,
        title: row.data.title || `${dealLabel.singular} - ${row.data.first_name || ''} ${row.data.last_name || ''}`.trim(),
        estimated_value: row.data.estimated_value ? parseFloat(row.data.estimated_value) : undefined,
        notes: row.data.notes || undefined,
        expected_close_date: row.data.expected_close_date || undefined,
      }
    })

    setImportProgress(30)

    try {
      const result = await dealsApi.import({
        rows,
        pipeline_id: activePipelineId,
        stage_id: stageId,
        assigned_to_override: assignedToOverride || null,
        lead_source_override: leadSourceOverride || null,
        duplicate_action: duplicateAction,
      })
      setImportResult(result)
    } catch {
      setImportResult({ imported: 0, skipped: 0, failed: selected.length, contacts_created: 0, contacts_matched: 0, failed_rows: [{ row: 0, reason: 'Import request failed' }] })
    }
    setImportProgress(100)
  }

  // --- Download failed ---

  const downloadFailed = () => {
    if (!importResult?.failed_rows.length) return
    const csv = generateFailedCSV(rawHeaders, importResult.failed_rows.map((f) => ({
      row: rawRows[f.row - 1] ?? [],
      reason: f.reason,
    })))
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
  const fieldLabels = mappedFields.map((key) => DEAL_CRM_FIELDS.find((f) => f.key === key)?.label ?? key)

  const filteredIndices = scrubbedRows
    .map((_, idx) => idx)
    .filter((idx) => {
      if (previewFilter === 'all') return true
      if (previewFilter === 'warnings') return scrubbedRows[idx].status === 'warning'
      if (previewFilter === 'errors') return scrubbedRows[idx].status === 'error'
      return true
    })

  const totalPreviewPages = Math.max(1, Math.ceil(filteredIndices.length / PAGE_SIZE))
  const pagedIndices = filteredIndices.slice(previewPage * PAGE_SIZE, (previewPage + 1) * PAGE_SIZE)

  const counts = {
    clean: scrubbedRows.filter((r) => r.status === 'clean').length,
    warnings: scrubbedRows.filter((r) => r.status === 'warning').length,
    errors: scrubbedRows.filter((r) => r.status === 'error').length,
  }

  const selectedCount = selectedRows.size

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

  // --- Helpers ---

  const canContinue = (): boolean => {
    switch (step) {
      case 'upload':
        return rawRows.length > 0
      case 'mapping':
        return mappings.some((m) => m.crmField === 'title') && mappings.some((m) => m.crmField === 'first_name' || m.crmField === 'last_name')
      case 'scrubbing':
        return true
      case 'preview':
        return selectedRows.size > 0
      case 'options':
        return !!stageId
      case 'importing':
        return false
    }
  }

  const continueLabel = (): string => {
    if (step === 'options') return `Import ${selectedCount} ${selectedCount === 1 ? dealLabel.singular : dealLabel.plural}`
    if (step === 'importing') return importResult ? 'Done' : 'Importing...'
    return 'Continue'
  }

  // --- Step renders ---

  function renderUpload() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload a CSV file with contact info and {dealLabel.singularLower} details. Each row becomes a contact + {dealLabel.singularLower} in your pipeline.
        </p>
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
          Map each CSV column to a field. You need at least a name and {dealLabel.singularLower} title.
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
                  <p className="text-xs text-muted-foreground truncate">e.g. &quot;{mapping.sampleValue}&quot;</p>
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
                  className="w-48 rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-body outline-none focus:border-primary"
                >
                  <option value="">Skip this column</option>
                  <optgroup label="Contact Fields">
                    {DEAL_CRM_FIELDS.filter((f) => CONTACT_FIELDS.has(f.key)).map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label={`${dealLabel.singular} Fields`}>
                    {DEAL_CRM_FIELDS.filter((f) => DEAL_FIELDS.has(f.key)).map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </optgroup>
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
          Data has been cleaned and validated. Review the summary below.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-success/20 bg-success/5 p-4 text-center">
            <p className="text-2xl font-bold text-success">{counts.clean}</p>
            <p className="text-xs font-medium text-success">Ready</p>
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
                    <span>Row {issue.row}: {issue.msg}</span>
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
                const bgClass =
                  row.status === 'error'
                    ? 'bg-danger/5'
                    : row.status === 'warning'
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
                        {row.status === 'clean' && (
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">Ready</span>
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
        {/* Pipeline stage */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Pipeline Stage</label>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-body outline-none focus:border-primary"
            >
              {pipelineStages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Assign To Rep</label>
            <select
              value={assignedToOverride}
              onChange={(e) => setAssignedToOverride(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-body outline-none focus:border-primary"
            >
              <option value="">Current user</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lead source override */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Lead Source Override</label>
          <select
            value={leadSourceOverride}
            onChange={(e) => setLeadSourceOverride(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-body outline-none focus:border-primary"
          >
            <option value="">Keep from CSV</option>
            {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Duplicate handling */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-heading">When a contact already exists</h4>
          <div className="space-y-2">
            {(
              [
                { value: 'skip' as const, label: `Skip - don't create ${dealLabel.singularLower}`, desc: 'If contact exists by email/phone, skip this row entirely' },
                { value: 'create' as const, label: `Create ${dealLabel.singularLower} anyway`, desc: `Link the new ${dealLabel.singularLower} to the existing contact` },
              ]
            ).map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  duplicateAction === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <input
                  type="radio"
                  name="duplicateAction"
                  value={opt.value}
                  checked={duplicateAction === opt.value}
                  onChange={() => setDuplicateAction(opt.value)}
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

        {/* Summary */}
        <div className="rounded-lg bg-primary/5 p-4 text-center">
          <p className="text-lg font-bold text-primary">
            Ready to import {selectedCount} {selectedCount === 1 ? dealLabel.singularLower : dealLabel.pluralLower}
          </p>
          <p className="text-xs text-muted-foreground">
            Each row creates a contact (if new) and a {dealLabel.singularLower} in {pipelineStages.find((s) => s.id === stageId)?.name ?? 'selected stage'}
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
            Importing {dealLabel.pluralLower}... {importProgress}%
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
            <p className="text-xs text-success">{dealLabel.plural} Created</p>
          </div>
          <div className="rounded-lg border border-info/20 bg-info/5 p-3 text-center">
            <p className="text-xl font-bold text-info">{importResult.contacts_created}</p>
            <p className="text-xs text-info">Contacts Created</p>
          </div>
          <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 text-center">
            <p className="text-xl font-bold text-warning">{importResult.contacts_matched}</p>
            <p className="text-xs text-warning">Contacts Matched</p>
          </div>
          <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-center">
            <p className="text-xl font-bold text-danger">{importResult.failed}</p>
            <p className="text-xs text-danger">Failed</p>
          </div>
        </div>

        {importResult.failed_rows.length > 0 && (
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
            <h3 className="text-lg font-semibold text-heading">
              {step === 'importing' ? STEP_LABELS[step] : `Import ${dealLabel.plural} - ${STEP_LABELS[step]}`}
            </h3>
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
