import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const widths = {
  sm: 'max-w-2xl',
  md: 'max-w-3xl',
  lg: 'max-w-5xl',
} as const

interface SlideOutPanelProps {
  open: boolean
  onClose: () => void
  title: string
  width?: keyof typeof widths
  children: React.ReactNode
}

export default function SlideOutPanel({
  open,
  onClose,
  title,
  width = 'md',
  children,
}: SlideOutPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      setTimeout(() => panelRef.current?.focus(), 0)
      document.body.style.overflow = 'hidden'
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-4 px-4">
        <div
          ref={panelRef}
          tabIndex={-1}
          className={`relative w-full ${widths[width]} rounded-2xl bg-white shadow-modal`}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-6 py-4 rounded-t-2xl">
            <h2 className="text-lg font-semibold text-heading">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-page hover:text-body"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
