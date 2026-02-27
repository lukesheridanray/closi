import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, GripVertical, Trash2, Plus } from 'lucide-react'
import usePipelineStore from '@/stores/pipelineStore'
import type { PipelineStage } from '@/types/pipeline'

const PRESET_COLORS = [
  '#6C63FF', '#3B82F6', '#8B5CF6', '#EC4899',
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4',
]

export default function PipelineSettings() {
  const navigate = useNavigate()
  const pipelines = usePipelineStore((s) => s.pipelines)
  const stages = usePipelineStore((s) => s.stages)
  const deals = usePipelineStore((s) => s.deals)
  const activePipelineId = usePipelineStore((s) => s.activePipelineId)
  const renamePipeline = usePipelineStore((s) => s.renamePipeline)
  const addStage = usePipelineStore((s) => s.addStage)
  const updateStage = usePipelineStore((s) => s.updateStage)
  const deleteStage = usePipelineStore((s) => s.deleteStage)
  const reorderStages = usePipelineStore((s) => s.reorderStages)

  const activePipeline = pipelines.find((p) => p.id === activePipelineId)
  const [pipelineName, setPipelineName] = useState(activePipeline?.name ?? '')
  const [deleteConfirm, setDeleteConfirm] = useState<{
    stageId: string
    dealCount: number
    reassignStageId: string
  } | null>(null)

  // Sync pipeline name with store when it changes externally
  useEffect(() => {
    if (activePipeline?.name) {
      setPipelineName(activePipeline.name)
    }
  }, [activePipeline?.name])

  const pipelineStages = useMemo(
    () => stages
      .filter((s) => s.pipeline_id === activePipelineId)
      .sort((a, b) => a.position - b.position),
    [stages, activePipelineId],
  )

  const dealCountByStage = useMemo(() => {
    const map = new Map<string, number>()
    deals.forEach((d) => {
      if (d.pipeline_id === activePipelineId) {
        map.set(d.stage_id, (map.get(d.stage_id) ?? 0) + 1)
      }
    })
    return map
  }, [deals, activePipelineId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = pipelineStages.findIndex((s) => s.id === active.id)
      const newIndex = pipelineStages.findIndex((s) => s.id === over.id)
      const reordered = arrayMove(pipelineStages, oldIndex, newIndex)
      reorderStages(activePipelineId, reordered.map((s) => s.id))
    },
    [pipelineStages, activePipelineId, reorderStages],
  )

  const handleSaveName = () => {
    if (pipelineName.trim() && activePipeline) {
      renamePipeline(activePipeline.id, pipelineName.trim())
    }
  }

  const handleDeleteClick = (stageId: string) => {
    const count = dealCountByStage.get(stageId) ?? 0
    // Find a default reassignment target (first stage that isn't the one being deleted)
    const defaultTarget = pipelineStages.find((s) => s.id !== stageId)
    if (count > 0) {
      setDeleteConfirm({
        stageId,
        dealCount: count,
        reassignStageId: defaultTarget?.id ?? '',
      })
    } else {
      deleteStage(stageId)
    }
  }

  const handleConfirmDelete = () => {
    if (deleteConfirm) {
      deleteStage(deleteConfirm.stageId, deleteConfirm.reassignStageId || undefined)
      setDeleteConfirm(null)
    }
  }

  const handleAddStage = () => {
    addStage(activePipelineId, {
      name: 'New Stage',
      color: PRESET_COLORS[pipelineStages.length % PRESET_COLORS.length],
      is_won: false,
      is_lost: false,
      is_active: true,
      stale_days: 7,
    })
  }

  // Escape key handler for delete modal
  useEffect(() => {
    if (!deleteConfirm) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeleteConfirm(null)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [deleteConfirm])

  // Available reassignment targets for delete modal
  const reassignTargets = useMemo(
    () => pipelineStages.filter((s) => s.id !== deleteConfirm?.stageId),
    [pipelineStages, deleteConfirm?.stageId],
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back link */}
      <button
        onClick={() => navigate('/pipeline')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-heading"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Pipeline
      </button>

      <h1 className="text-xl font-bold text-heading">Pipeline Settings</h1>

      {/* Pipeline name */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-card">
        <label className="mb-2 block text-sm font-medium text-heading">
          Pipeline Name
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={pipelineName}
            onChange={(e) => setPipelineName(e.target.value)}
            maxLength={100}
            className="flex-1 border-b border-border bg-transparent px-1 py-1.5 text-sm text-heading outline-none transition-colors focus:border-primary"
          />
          <button
            onClick={handleSaveName}
            disabled={!pipelineName.trim() || pipelineName.trim() === activePipeline?.name}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>

      {/* Stages */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-card">
        <h2 className="mb-4 text-sm font-semibold text-heading">Stages</h2>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={pipelineStages.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {pipelineStages.map((stage) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  dealCount={dealCountByStage.get(stage.id) ?? 0}
                  onUpdate={updateStage}
                  onDelete={() => handleDeleteClick(stage.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          onClick={handleAddStage}
          className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          Add Stage
        </button>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDeleteConfirm(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-stage-title"
          aria-describedby="delete-stage-desc"
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-stage-title" className="text-base font-semibold text-heading">
              Delete Stage
            </h3>
            <p id="delete-stage-desc" className="mt-2 text-sm text-muted-foreground">
              This stage has <span className="font-semibold text-heading">{deleteConfirm.dealCount}</span> deal{deleteConfirm.dealCount !== 1 ? 's' : ''} in it. Choose a stage to move them to before deleting.
            </p>

            {/* Reassignment target selector */}
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-heading">
                Move deals to
              </label>
              <select
                value={deleteConfirm.reassignStageId}
                onChange={(e) => setDeleteConfirm({ ...deleteConfirm, reassignStageId: e.target.value })}
                className="w-full border-b border-border bg-transparent px-1 py-1.5 text-sm text-heading outline-none transition-colors focus:border-primary"
              >
                {reassignTargets.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-heading transition-colors hover:bg-page"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={!deleteConfirm.reassignStageId}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Stage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Stage Row ---

interface StageRowProps {
  stage: PipelineStage
  dealCount: number
  onUpdate: (stageId: string, updates: Partial<Pick<PipelineStage, 'name' | 'color' | 'stale_days' | 'is_active'>>) => void
  onDelete: () => void
}

function StageRow({ stage, dealCount, onUpdate, onDelete }: StageRowProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [localName, setLocalName] = useState(stage.name)
  const colorPickerRef = useRef<HTMLDivElement>(null)

  // Sync local name when store changes (e.g. undo, external update)
  useEffect(() => {
    setLocalName(stage.name)
  }, [stage.name])

  // Click-outside handler for color picker
  useEffect(() => {
    if (!showColorPicker) return
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColorPicker])

  // Escape to close color picker
  useEffect(() => {
    if (!showColorPicker) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowColorPicker(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [showColorPicker])

  const handleNameBlur = () => {
    const trimmed = localName.trim()
    if (trimmed && trimmed !== stage.name) {
      onUpdate(stage.id, { name: trimmed })
    } else {
      setLocalName(stage.name) // revert if empty
    }
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-page ${
        isDragging ? 'opacity-50 bg-page' : ''
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
        aria-label={`Reorder ${stage.name}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Color swatch */}
      <div className="relative" ref={colorPickerRef}>
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="h-5 w-5 rounded-full border border-border transition-shadow hover:ring-2 hover:ring-primary/20"
          style={{ backgroundColor: stage.color }}
          aria-label={`Change color for ${stage.name}`}
          aria-expanded={showColorPicker}
        />
        {showColorPicker && (
          <div className="absolute left-0 top-8 z-10 grid grid-cols-4 gap-1.5 rounded-lg border border-border bg-white p-3 shadow-modal">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => {
                  onUpdate(stage.id, { color })
                  setShowColorPicker(false)
                }}
                className={`h-6 w-6 rounded-full border transition-shadow hover:ring-2 hover:ring-primary/20 ${
                  color === stage.color ? 'ring-2 ring-primary border-primary' : 'border-border'
                }`}
                style={{ backgroundColor: color }}
                aria-label={color}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stage name -- local state, commit on blur */}
      <input
        type="text"
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={handleNameBlur}
        maxLength={100}
        className="min-w-0 flex-1 border-b border-transparent bg-transparent px-1 py-0.5 text-sm text-heading outline-none transition-colors focus:border-primary"
      />

      {/* Stale days */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Stale after</span>
        <input
          type="number"
          min={1}
          max={365}
          value={stage.stale_days}
          onChange={(e) => onUpdate(stage.id, { stale_days: Math.min(365, Math.max(1, parseInt(e.target.value) || 1)) })}
          className="w-14 border-b border-border bg-transparent px-1 py-0.5 text-center text-sm text-heading outline-none transition-colors focus:border-primary"
        />
        <span className="text-xs text-muted-foreground">days</span>
      </div>

      {/* Won/Lost badge */}
      {stage.is_won && (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Won</span>
      )}
      {stage.is_lost && (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Lost</span>
      )}

      {/* Deal count */}
      {dealCount > 0 && (
        <span className="text-xs text-muted-foreground">{dealCount} deal{dealCount !== 1 ? 's' : ''}</span>
      )}

      {/* Delete */}
      <button
        onClick={onDelete}
        disabled={stage.is_won || stage.is_lost}
        className="text-muted-foreground/50 transition-colors hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-muted-foreground/50"
        title={stage.is_won || stage.is_lost ? 'Cannot delete Won/Lost stages' : 'Delete stage'}
        aria-label={`Delete ${stage.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
