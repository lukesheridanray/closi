import { useState } from 'react'
import { FileText, Phone, CheckSquare, X } from 'lucide-react'
import useContactStore from '@/stores/contactStore'
import useTaskStore from '@/stores/taskStore'
import type { ActivityType } from '@/types/contact'
import type { TaskType, TaskPriority } from '@/types/task'
import { TASK_TYPE_LABELS, TASK_PRIORITY_LABELS } from '@/types/task'

interface QuickActionsProps {
  contactId: string
  dealId?: string | null
}

type ModalType = 'note' | 'call' | 'task' | null

export default function QuickActions({ contactId, dealId }: QuickActionsProps) {
  const [modal, setModal] = useState<ModalType>(null)

  return (
    <>
      <div className="flex gap-2">
        <ActionButton
          icon={FileText}
          label="Add Note"
          onClick={() => setModal('note')}
        />
        <ActionButton
          icon={Phone}
          label="Log Call"
          onClick={() => setModal('call')}
        />
        <ActionButton
          icon={CheckSquare}
          label="Create Task"
          onClick={() => setModal('task')}
        />
      </div>

      {modal === 'task' && (
        <QuickTaskModal
          contactId={contactId}
          dealId={dealId ?? null}
          onClose={() => setModal(null)}
        />
      )}

      {modal && modal !== 'task' && (
        <QuickActionModal
          type={modal}
          contactId={contactId}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof FileText
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-body shadow-card transition-colors hover:bg-page"
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      {label}
    </button>
  )
}

// --- Quick Action Modal (Note / Call) ---

const modalConfig: Record<'note' | 'call', { title: string; activityType: ActivityType; subjectPlaceholder: string; descPlaceholder: string }> = {
  note: {
    title: 'Add Note',
    activityType: 'note',
    subjectPlaceholder: 'Note subject',
    descPlaceholder: 'Write your note...',
  },
  call: {
    title: 'Log Call',
    activityType: 'call',
    subjectPlaceholder: 'Call subject',
    descPlaceholder: 'Call summary and key takeaways...',
  },
}

function QuickActionModal({
  type,
  contactId,
  onClose,
}: {
  type: 'note' | 'call'
  contactId: string
  onClose: () => void
}) {
  const addActivity = useContactStore((s) => s.addActivity)
  const config = modalConfig[type]
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim()) return

    addActivity({
      contact_id: contactId,
      deal_id: null,
      type: config.activityType,
      subject: subject.trim(),
      description: description.trim(),
      performed_by: 'You',
      performed_at: new Date().toISOString(),
    })
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 top-[20%] z-50 mx-auto w-full max-w-md">
        <form
          onSubmit={handleSubmit}
          className="mx-4 rounded-2xl bg-white shadow-modal"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold text-heading">{config.title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-page hover:text-body"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 p-5">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={config.subjectPlaceholder}
              autoFocus
              className="w-full border-b border-border bg-transparent pb-2 text-sm text-heading outline-none placeholder:text-placeholder focus:border-primary"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={config.descPlaceholder}
              rows={3}
              className="w-full resize-none border-b border-border bg-transparent pb-2 text-sm text-body outline-none placeholder:text-placeholder focus:border-primary"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-page"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!subject.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// --- Quick Task Modal ---

function QuickTaskModal({
  contactId,
  dealId,
  onClose,
}: {
  contactId: string
  dealId: string | null
  onClose: () => void
}) {
  const addTask = useTaskStore((s) => s.addTask)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<TaskType>('follow_up')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !dueDate) return

    addTask({
      contact_id: contactId,
      deal_id: dealId,
      assigned_to: 'Rep A',
      created_by: 'You',
      title: title.trim(),
      description: description.trim(),
      priority,
      status: 'pending',
      type,
      due_date: dueDate,
      due_time: null,
      duration_minutes: 30,
      is_all_day: true,
      recurrence: null,
    })
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 top-[20%] z-50 mx-auto w-full max-w-md">
        <form
          onSubmit={handleSubmit}
          className="mx-4 rounded-2xl bg-white shadow-modal"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold text-heading">Create Task</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-page hover:text-body"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 p-5">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              autoFocus
              className="w-full border-b border-border bg-transparent pb-2 text-sm text-heading outline-none placeholder:text-placeholder focus:border-primary"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full resize-none border-b border-border bg-transparent pb-2 text-sm text-body outline-none placeholder:text-placeholder focus:border-primary"
            />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TaskType)}
                  className="w-full rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-body outline-none focus:border-primary"
                >
                  {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-body outline-none focus:border-primary"
                >
                  {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-body outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-page"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !dueDate}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
