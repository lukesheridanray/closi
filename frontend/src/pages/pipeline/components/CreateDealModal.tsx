import { useState, useEffect } from 'react'
import SlideOutPanel from '@/components/layout/SlideOutPanel'
import usePipelineStore from '@/stores/pipelineStore'
import { useEntityLabels } from '@/hooks/useEntityLabels'
import { usersApi } from '@/lib/api'
import type { User } from '@/lib/api'

interface CreateDealModalProps {
  open: boolean
  onClose: () => void
}

export default function CreateDealModal({ open, onClose }: CreateDealModalProps) {
  const { deal: dealLabel } = useEntityLabels()
  const contacts = usePipelineStore((s) => s.contacts)
  const stages = usePipelineStore((s) => s.stages)
  const activePipelineId = usePipelineStore((s) => s.activePipelineId)
  const createDeal = usePipelineStore((s) => s.createDeal)

  const [users, setUsers] = useState<User[]>([])
  const [saving, setSaving] = useState(false)
  const [contactSearch, setContactSearch] = useState('')
  const [form, setForm] = useState({
    title: '',
    contact_id: '',
    estimated_value: '',
    assigned_to: '',
    stage_id: '',
    expected_close_date: '',
    notes: '',
  })

  useEffect(() => {
    if (open) {
      usersApi.list().then((data) => setUsers(data.items))
      // Default to first active stage
      const activeStages = stages
        .filter((s) => s.pipeline_id === activePipelineId && s.is_active && !s.is_won_stage && !s.is_lost_stage)
        .sort((a, b) => a.sort_order - b.sort_order)
      if (activeStages.length > 0) {
        setForm((f) => ({ ...f, stage_id: activeStages[0].id }))
      }
    }
  }, [open, stages, activePipelineId])

  const pipelineStages = stages
    .filter((s) => s.pipeline_id === activePipelineId && s.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)

  const filteredContacts = contactSearch
    ? contacts.filter((c) => {
        const term = contactSearch.toLowerCase()
        return (
          c.first_name.toLowerCase().includes(term) ||
          c.last_name.toLowerCase().includes(term) ||
          (c.email && c.email.toLowerCase().includes(term))
        )
      })
    : contacts

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.contact_id || !activePipelineId) return
    setSaving(true)
    try {
      await createDeal({
        title: form.title,
        contact_id: form.contact_id,
        pipeline_id: activePipelineId,
        stage_id: form.stage_id || undefined,
        estimated_value: parseFloat(form.estimated_value) || 0,
        assigned_to: form.assigned_to || undefined,
        expected_close_date: form.expected_close_date || undefined,
        notes: form.notes || undefined,
      })
      setForm({ title: '', contact_id: '', estimated_value: '', assigned_to: '', stage_id: '', expected_close_date: '', notes: '' })
      setContactSearch('')
      onClose()
    } catch {
      // error is handled by store
    } finally {
      setSaving(false)
    }
  }

  const selectedContact = contacts.find((c) => c.id === form.contact_id)

  const inputClass = 'w-full border-b border-border bg-transparent py-2 text-sm text-heading outline-none placeholder:text-placeholder focus:border-primary'
  const labelClass = 'text-xs font-medium text-muted-foreground'

  return (
    <SlideOutPanel open={open} onClose={onClose} title={`New ${dealLabel.singular}`} width="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={labelClass}>{dealLabel.singular} Name *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g., Smith - Home Security Package"
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>Contact *</label>
          {selectedContact ? (
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-heading">{selectedContact.first_name} {selectedContact.last_name}</span>
              <button type="button" onClick={() => setForm({ ...form, contact_id: '' })} className="text-xs text-primary hover:underline">
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search contacts..."
                className={inputClass}
              />
              {contactSearch && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-white shadow-sm">
                  {filteredContacts.slice(0, 10).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, contact_id: c.id })
                        setContactSearch('')
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-page"
                    >
                      <span className="font-medium text-heading">{c.first_name} {c.last_name}</span>
                      {c.email && <span className="ml-2 text-muted-foreground">{c.email}</span>}
                    </button>
                  ))}
                  {filteredContacts.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No contacts found</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <label className={labelClass}>Estimated Value ($)</label>
          <input
            type="number"
            value={form.estimated_value}
            onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
            placeholder="0"
            min="0"
            step="0.01"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Assigned Rep</label>
          <select
            value={form.assigned_to}
            onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
            className={inputClass}
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Pipeline Stage</label>
          <select
            value={form.stage_id}
            onChange={(e) => setForm({ ...form, stage_id: e.target.value })}
            className={inputClass}
          >
            {pipelineStages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Expected Close Date</label>
          <input
            type="date"
            value={form.expected_close_date}
            onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Any additional details..."
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-body hover:bg-page"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !form.title || !form.contact_id}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? 'Creating...' : `Create ${dealLabel.singular}`}
          </button>
        </div>
      </form>
    </SlideOutPanel>
  )
}
