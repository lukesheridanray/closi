import { useState } from 'react'
import useTaskStore from '@/stores/taskStore'
import usePipelineStore from '@/stores/pipelineStore'

interface SchedulingState {
  dealId: string
  contactId: string
  toStageId: string
  stageName: string
  taskType: 'site_visit' | 'install'
  taskTitle: string
}

export function useSchedulingPrompt() {
  const moveDeal = usePipelineStore((s) => s.moveDeal)
  const stages = usePipelineStore((s) => s.stages)
  const addTask = useTaskStore((s) => s.addTask)

  const [prompt, setPrompt] = useState<SchedulingState | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [working, setWorking] = useState(false)

  function interceptMoveDeal(dealId: string, toStageId: string, contactId: string, customerName: string) {
    const targetStage = stages.find((s) => s.id === toStageId)
    if (!targetStage) { moveDeal(dealId, toStageId); return }

    const name = targetStage.name.toLowerCase().trim()

    if (name === 'appointment scheduled') {
      const suggested = new Date()
      suggested.setDate(suggested.getDate() + 2)
      if (suggested.getDay() === 0) suggested.setDate(suggested.getDate() + 1)
      if (suggested.getDay() === 6) suggested.setDate(suggested.getDate() + 2)
      setDate(suggested.toISOString().split('T')[0])
      setTime('10:00')
      setPrompt({
        dealId, contactId, toStageId,
        stageName: 'Appointment',
        taskType: 'site_visit',
        taskTitle: `Site Visit - ${customerName}`,
      })
      return
    }

    if (name === 'install scheduled') {
      const suggested = new Date()
      suggested.setDate(suggested.getDate() + 5)
      if (suggested.getDay() === 0) suggested.setDate(suggested.getDate() + 1)
      if (suggested.getDay() === 6) suggested.setDate(suggested.getDate() + 2)
      setDate(suggested.toISOString().split('T')[0])
      setTime('08:00')
      setPrompt({
        dealId, contactId, toStageId,
        stageName: 'Install',
        taskType: 'install',
        taskTitle: `Install - ${customerName}`,
      })
      return
    }

    moveDeal(dealId, toStageId)
  }

  async function confirm() {
    if (!prompt || !date) return
    setWorking(true)
    try {
      await moveDeal(prompt.dealId, prompt.toStageId)
      await addTask({
        contact_id: prompt.contactId,
        deal_id: prompt.dealId,
        title: prompt.taskTitle,
        type: prompt.taskType,
        priority: prompt.taskType === 'install' ? 'high' : 'medium',
        status: 'pending',
        due_date: date,
        due_time: time || undefined,
      })
      dismiss()
    } finally {
      setWorking(false)
    }
  }

  function dismiss() {
    setPrompt(null)
    setDate('')
    setTime('')
  }

  return { prompt, date, time, working, setDate, setTime, confirm, dismiss, interceptMoveDeal }
}

/** Reusable scheduling modal UI */
export function SchedulingModal({
  prompt,
  date,
  time,
  working,
  setDate,
  setTime,
  confirm,
  dismiss,
}: ReturnType<typeof useSchedulingPrompt>) {
  if (!prompt) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={dismiss} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white shadow-modal p-5">
          <h3 className="text-sm font-semibold text-heading">
            Schedule {prompt.stageName}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {prompt.taskTitle}
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-heading outline-none focus:border-primary"
              />
              {date && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-heading outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={dismiss}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-page"
            >
              Cancel
            </button>
            <button
              onClick={confirm}
              disabled={working || !date}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {working ? 'Scheduling...' : 'Schedule & Move'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
