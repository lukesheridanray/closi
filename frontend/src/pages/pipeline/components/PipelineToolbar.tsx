import { ChevronDown, Plus } from 'lucide-react'
import usePipelineStore from '@/stores/pipelineStore'

export default function PipelineToolbar() {
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

      {/* Stubbed filters */}
      <button className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm text-muted-foreground shadow-card transition-colors hover:bg-page">
        Rep
        <ChevronDown className="h-4 w-4" />
      </button>

      <button className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm text-muted-foreground shadow-card transition-colors hover:bg-page">
        Date
        <ChevronDown className="h-4 w-4" />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* New Deal button */}
      <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-card transition-colors hover:bg-primary-hover">
        <Plus className="h-4 w-4" />
        New Deal
      </button>
    </div>
  )
}
