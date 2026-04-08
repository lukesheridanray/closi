import { useEffect, useCallback, useState } from 'react'
import { Search, HelpCircle } from 'lucide-react'
import usePageTitle from '@/hooks/usePageTitle'
import GlobalSearch from '@/components/shared/GlobalSearch'

export default function PageHeader() {
  const title = usePageTitle()
  const [searchOpen, setSearchOpen] = useState(false)

  const openSearch = useCallback(() => setSearchOpen(true), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])

  useEffect(() => {
    window.addEventListener('open-search', openSearch)
    return () => window.removeEventListener('open-search', openSearch)
  }, [openSearch])

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-white px-6">
        <h1 className="text-lg font-semibold text-heading">{title}</h1>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-page hover:text-body"
            title="Search (Ctrl+K)"
          >
            <Search className="h-4 w-4" />
            <span className="hidden text-sm lg:inline">Search</span>
            <kbd className="hidden rounded border border-border bg-page px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground lg:inline">
              Ctrl K
            </kbd>
          </button>
          <button
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-page hover:text-body"
            title="Help"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onClose={closeSearch} />
    </>
  )
}
