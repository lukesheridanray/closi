import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const widths = {
  sm: 'w-[360px]',
  md: 'w-[480px]',
  lg: 'w-[640px]',
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

  // Focus trap: focus panel when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => panelRef.current?.focus(), 0)
    }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`fixed right-0 top-0 z-50 flex h-full flex-col bg-white shadow-modal ${widths[width]} animate-in slide-in-from-right duration-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-heading">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-page hover:text-body"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </>
  )
}
