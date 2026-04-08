import { useState } from 'react'
import { X } from 'lucide-react'
import useTaskStore from '@/stores/taskStore'
import useContactStore from '@/stores/contactStore'
import { TASK_TYPE_LABELS, TASK_PRIORITY_LABELS } from '@/types/task'
import type { TaskType, TaskPriority } from '@/types/task'

interface CreateTaskModalProps {
  onClose: () => void
  prefillContactId?: string | null
  prefillDealId?: string | null
  prefillDueDate?: string | null
}

export default function CreateTaskModal({ onClose, prefillContactId, prefillDealId, prefillDueDate }: CreateTaskModalProps) {
  const addTask = useTaskStore((s) => s.addTask)
  const contacts = useContactStore((s) => s.contacts)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<TaskType>('follow_up')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = useState(prefillDueDate ?? new Date().toISOString().split('T')[0])
  const [dueTime, setDueTime] = useState('')
  const [assignedTo, setAssignedTo] = useState('Rep A')
  const [contactId, setContactId] = useState(prefillContactId ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !dueDate) return

    addTask({
      contact_id: contactId || null,
      deal_id: prefillDealId ?? null,
      assigned_to: assignedTo || null,
      created_by: 'You',
      title: title.trim(),
      description: description.trim(),
      priority,
      status: 'pending',
      type,
      due_date: dueDate,
      due_time: dueTime || null,
      duration_minutes: 30,
      is_all_day: !dueTime,
      recurrence: 'none',
    })
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 top-[10%] z-50 mx-auto w-full max-w-lg">
        <form
          onSubmit={handleSubmit}
          className="mx-4 rounded-2xl bg-white shadow-modal"
        >
          {/* Header */}
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

          {/* Body */}
          <div className="space-y-4 p-5">
            {/* Title */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              autoFocus
              className="w-full border-b border-border bg-transparent pb-2 text-sm text-heading outline-none placeholder:text-placeholder focus:border-primary"
            />

            {/* Description */}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full resize-none border-b border-border bg-transparent pb-2 text-sm text-body outline-none placeholder:text-placeholder focus:border-primary"
            />

            {/* Type + Priority row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TaskType)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-body outline-none focus:border-primary"
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
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-body outline-none focus:border-primary"
                >
                  {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due date + time row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-body outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Time (optional)</label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-body outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Assignee + Contact row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Assigned To</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-body outline-none focus:border-primary"
                >
                  <option value="Rep A">Rep A</option>
                  <option value="Rep B">Rep B</option>
                  <option value="Rep C">Rep C</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Contact</label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-body outline-none focus:border-primary"
                >
                  <option value="">None</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
