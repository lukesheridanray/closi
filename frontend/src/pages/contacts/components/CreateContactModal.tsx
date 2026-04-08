import { useState, useEffect, useMemo } from 'react'
import SlideOutPanel from '@/components/layout/SlideOutPanel'
import useContactStore from '@/stores/contactStore'
import usePipelineStore from '@/stores/pipelineStore'
import { useEntityLabels } from '@/hooks/useEntityLabels'
import { dealsApi } from '@/lib/api'
import { LEAD_SOURCE_LABELS } from '@/types/contact'
import type { LeadSource } from '@/types/contact'

interface CreateContactModalProps {
  open: boolean
  onClose: () => void
}

export default function CreateContactModal({ open, onClose }: CreateContactModalProps) {
  const { deal: dealLabel } = useEntityLabels()
  const createContact = useContactStore((s) => s.createContact)
  const stages = usePipelineStore((s) => s.stages)
  const activePipelineId = usePipelineStore((s) => s.activePipelineId)
  const fetchPipelines = usePipelineStore((s) => s.fetchPipelines)

  const [saving, setSaving] = useState(false)
  const [skipPipeline, setSkipPipeline] = useState(false)
  const [pipelineStageId, setPipelineStageId] = useState('')
  const [dealTitle, setDealTitle] = useState('')

  const pipelineStages = useMemo(
    () => stages
      .filter((s) => s.pipeline_id === activePipelineId && s.is_active && !s.is_lost_stage)
      .sort((a, b) => a.sort_order - b.sort_order),
    [stages, activePipelineId],
  )

  // Ensure pipeline data loaded
  useEffect(() => { fetchPipelines() }, [fetchPipelines])

  // Set default stage when stages load
  useEffect(() => {
    if (pipelineStages.length > 0 && !pipelineStageId) {
      setPipelineStageId(pipelineStages[0].id)
    }
  }, [pipelineStages, pipelineStageId])

  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    lead_source: 'other' as LeadSource,
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name || !form.last_name) return
    setSaving(true)
    setError(null)
    try {
      const contact = await createContact({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        zip: form.zip || undefined,
        lead_source: form.lead_source,
        notes: form.notes || undefined,
      })

      // Auto-create deal if pipeline stage selected
      if (!skipPipeline && pipelineStageId && activePipelineId && contact?.id) {
        const title = dealTitle.trim() || `${form.first_name} ${form.last_name}`
        await dealsApi.create({
          contact_id: contact.id,
          pipeline_id: activePipelineId,
          stage_id: pipelineStageId,
          title,
          estimated_value: 0,
        }).catch(() => {})
      }

      setForm({ first_name: '', last_name: '', email: '', phone: '', address: '', city: '', state: '', zip: '', lead_source: 'other', notes: '' })
      setSkipPipeline(false)
      setDealTitle('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create contact')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full border-b border-border bg-transparent py-2 text-sm text-heading outline-none placeholder:text-placeholder focus:border-primary'
  const labelClass = 'text-xs font-medium text-muted-foreground'

  return (
    <SlideOutPanel open={open} onClose={onClose} title="Add Lead" width="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>First Name *</label>
            <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="First name" className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Last Name *</label>
            <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Last name" className={inputClass} required />
          </div>
        </div>

        <div>
          <label className={labelClass}>Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Phone</label>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 555-5555" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Address</label>
          <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address" className={inputClass} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>City</label>
            <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <input type="text" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="ST" className={inputClass} maxLength={2} />
          </div>
          <div>
            <label className={labelClass}>Zip</label>
            <input type="text" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} placeholder="Zip" className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Lead Source</label>
          <select value={form.lead_source} onChange={(e) => setForm({ ...form, lead_source: e.target.value as LeadSource })} className={inputClass}>
            {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Pipeline placement — always on by default */}
        <div className="rounded-lg border border-border p-4">
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Pipeline Stage</label>
              <select
                value={pipelineStageId}
                onChange={(e) => setPipelineStageId(e.target.value)}
                disabled={skipPipeline}
                className={`${inputClass} ${skipPipeline ? 'opacity-40' : ''}`}
              >
                {pipelineStages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{dealLabel.singular} Title</label>
              <input
                type="text"
                value={dealTitle}
                onChange={(e) => setDealTitle(e.target.value)}
                disabled={skipPipeline}
                placeholder={`e.g. ${form.first_name || 'Vaughan'} ${form.last_name || ''} - Home Security`.trim()}
                className={`${inputClass} ${skipPipeline ? 'opacity-40' : ''}`}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Leave blank to use the contact name
              </p>
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              checked={skipPipeline}
              onChange={(e) => setSkipPipeline(e.target.checked)}
              className="accent-primary h-3.5 w-3.5 rounded"
            />
            <span className="text-xs text-muted-foreground">Skip pipeline (contact only, no deal)</span>
          </label>
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any notes about this contact..." rows={3} className={`${inputClass} resize-none`} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-body hover:bg-page">Cancel</button>
          <button type="submit" disabled={saving || !form.first_name || !form.last_name} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50">
            {saving ? 'Saving...' : 'Add Lead'}
          </button>
        </div>
      </form>
    </SlideOutPanel>
  )
}
