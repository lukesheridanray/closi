import { useEffect, useCallback, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, HelpCircle, CalendarDays, CheckCircle2, Plus } from 'lucide-react'
import { format, isToday, isPast } from 'date-fns'
import useAuthStore from '@/stores/authStore'
import useTaskStore from '@/stores/taskStore'
import usePageTitle from '@/hooks/usePageTitle'
import GlobalSearch from '@/components/shared/GlobalSearch'

export default function PageHeader() {
  const navigate = useNavigate()
  const title = usePageTitle()
  const user = useAuthStore((s) => s.user)
  const tasks = useTaskStore((s) => s.tasks)
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const [searchOpen, setSearchOpen] = useState(false)

  const openSearch = useCallback(() => setSearchOpen(true), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])

  useEffect(() => { fetchTasks() }, [fetchTasks])
  useEffect(() => {
    window.addEventListener('open-search', openSearch)
    return () => window.removeEventListener('open-search', openSearch)
  }, [openSearch])

  const today = new Date()
  const dayOfWeek = format(today, 'EEE')
  const dayNum = format(today, 'd')

  // Next upcoming task
  const nextTask = useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'completed' && t.status !== 'cancelled' && t.due_date)
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
      .find((t) => {
        const d = new Date(t.due_date!)
        return isToday(d) || !isPast(d)
      })
  }, [tasks])

  // Task counts
  const overdueTasks = useMemo(() =>
    tasks.filter((t) =>
      t.status !== 'completed' && t.status !== 'cancelled' &&
      t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))
    ).length
  , [tasks])

  const todayTasks = useMemo(() =>
    tasks.filter((t) =>
      t.status !== 'completed' && t.status !== 'cancelled' &&
      t.due_date && isToday(new Date(t.due_date))
    ).length
  , [tasks])

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`
    : '?'

  return (
    <>
      <header className="sticky top-0 z-10 flex h-12 items-center border-b border-border bg-white px-4">
        {/* Left: page title */}
        <h1 className="text-sm font-semibold text-heading">{title}</h1>

        {/* Center-right: date + next task */}
        <div className="ml-auto flex items-center gap-4">
          {/* Today's date block */}
          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex h-9 w-9 flex-col items-center justify-center rounded-lg bg-page">
              <span className="text-[9px] font-semibold uppercase leading-none text-muted-foreground">{dayOfWeek}</span>
              <span className="text-sm font-bold leading-tight text-heading">{dayNum}</span>
            </div>

            {/* Next task preview */}
            {nextTask && (
              <button
                onClick={() => navigate('/tasks')}
                className="hidden items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-page lg:flex"
              >
                <div className="max-w-[200px]">
                  <p className="truncate text-xs font-medium text-heading">{nextTask.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {nextTask.due_date && isToday(new Date(nextTask.due_date)) ? 'Today' : nextTask.due_date ? format(new Date(nextTask.due_date), 'MMM d') : ''}
                  </p>
                </div>
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="hidden h-6 w-px bg-border sm:block" />

          {/* Action icons */}
          <div className="flex items-center gap-0.5">
            {/* Quick add */}
            <button
              onClick={() => navigate('/accounts')}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-page hover:text-heading"
              title="Add Lead"
            >
              <Plus className="h-4 w-4" />
            </button>

            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-page hover:text-heading"
              title="Search (Ctrl+K)"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Tasks / notifications */}
            <button
              onClick={() => navigate('/tasks')}
              className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-page hover:text-heading"
              title={`${todayTasks} tasks today${overdueTasks > 0 ? `, ${overdueTasks} overdue` : ''}`}
            >
              <Bell className="h-4 w-4" />
              {(todayTasks + overdueTasks) > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                  {todayTasks + overdueTasks}
                </span>
              )}
            </button>

            {/* Calendar */}
            <button
              onClick={() => navigate('/tasks')}
              className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-page hover:text-heading sm:block"
              title="Calendar"
            >
              <CalendarDays className="h-4 w-4" />
            </button>

            {/* Help */}
            <button
              className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-page hover:text-heading sm:block"
              title="Help"
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            {/* User avatar */}
            <div className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white" title={user ? `${user.first_name} ${user.last_name}` : ''}>
              {initials}
            </div>
          </div>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onClose={closeSearch} />
    </>
  )
}
