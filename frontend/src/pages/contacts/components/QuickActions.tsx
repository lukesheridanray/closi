import { useState } from 'react'
import { FileText, Phone, CheckSquare, X } from 'lucide-react'
import useContactStore from '@/stores/contactStore'
import type { ActivityType } from '@/types/contact'

interface QuickActionsProps {
  contactId: string
}

type ModalType = 'note' | 'call' | 'task' | null

export default function QuickActions({ contactId }: QuickActionsProps) {
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

      {modal && (
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

// --- Quick Action Modal ---

const modalConfig: Record<Exclude<ModalType, null>, { title: string; activityType: ActivityType; subjectPlaceholder: string; descPlaceholder: string }> = {
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
  task: {
    title: 'Create Task',
    activityType: 'task_created',
    subjectPlaceholder: 'Task title',
    descPlaceholder: 'Task description...',
  },
}

function QuickActionModal({
  type,
  contactId,
  onClose,
}: {
  type: Exclude<ModalType, null>
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
          {/* Header */}
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

          {/* Body */}
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

          {/* Footer */}
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
