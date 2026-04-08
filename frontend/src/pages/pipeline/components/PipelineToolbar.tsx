import { useNavigate } from 'react-router-dom'
import { ChevronDown, Plus, Search, Settings, Upload } from 'lucide-react'
import usePipelineStore from '@/stores/pipelineStore'
import { useEntityLabels } from '@/hooks/useEntityLabels'

interface PipelineToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  onNewDeal?: () => void
  onImport?: () => void
}

export default function PipelineToolbar({ search, onSearchChange, onNewDeal, onImport }: PipelineToolbarProps) {
  const { deal } = useEntityLabels()
  const navigate = useNavigate()
  const pipelines = usePipelineStore((s) => s.pipelines)
  const activePipelineId = usePipelineStore((s) => s.activePipelineId)

  const activePipeline = pipelines.find((p) => p.id === activePipelineId)

  return (
    <div className="flex items-center gap-3">
      {/* Pipeline selector */}
      <div className="relative">
        <button className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-heading shadow-card transition-colors hover:bg-page">
          {activePipeline?.name ?? 'Select Pipeline'}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={`Search ${deal.pluralLower}...`}
          className="rounded-lg border border-border bg-white pl-9 pr-3 py-2 text-sm text-body placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-56"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Pipeline settings */}
      <button
        onClick={() => navigate('/settings/pipeline')}
        className="flex items-center justify-center rounded-lg border border-border bg-white p-2 text-muted-foreground shadow-card transition-colors hover:bg-page hover:text-heading"
        title="Pipeline Settings"
      >
        <Settings className="h-4 w-4" />
      </button>

      {/* Import CSV button */}
      <button
        onClick={onImport}
        className="flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-heading shadow-card transition-colors hover:bg-page"
      >
        <Upload className="h-4 w-4" />
        Import CSV
      </button>

      {/* New Deal button */}
      <button
        onClick={onNewDeal}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-card transition-colors hover:bg-primary-hover"
      >
        <Plus className="h-4 w-4" />
        New {deal.singular}
      </button>
    </div>
  )
}
