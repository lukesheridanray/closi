import { useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { mainNavItems } from '@/lib/navigation'

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) {
          onClose()
        } else {
          // parent will set open=true via PageHeader
          // dispatch a custom event so PageHeader can pick it up
          window.dispatchEvent(new CustomEvent('open-search'))
        }
      }
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-0 top-[20%] z-50 mx-auto w-full max-w-lg">
        <div className="mx-4 overflow-hidden rounded-2xl bg-white shadow-modal">
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search pages, contacts, deals..."
              className="flex-1 bg-transparent text-sm text-heading outline-none placeholder:text-placeholder"
            />
            <kbd className="rounded border border-border bg-page px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Quick links */}
          <div className="max-h-80 overflow-y-auto p-2">
            <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pages
            </p>
            {mainNavItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path)
                  onClose()
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-body transition-colors hover:bg-page"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
