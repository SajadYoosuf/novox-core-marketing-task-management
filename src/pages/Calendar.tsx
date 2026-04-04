import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
  startOfWeek,
  endOfWeek,
  isToday,
  addMonths,
  subMonths
} from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  LayoutGrid,
  Camera,
  Briefcase,
  Globe,
  Share2
} from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import type { Client, TaskRow, TaskPlatformRow } from '@/types/db'

const PlatformIcon = ({ platform }: { platform?: string }) => {
  const p = platform?.toLowerCase()
  if (p === 'instagram') return <Camera className="h-3 w-3 text-pink-500" />
  if (p === 'facebook') return <Share2 className="h-3 w-3 text-blue-600" />
  if (p === 'linkedin') return <Briefcase className="h-3 w-3 text-blue-700" />
  if (p === 'gmb') return <Share2 className="h-3 w-3 text-emerald-500" />
  return <Globe className="h-3 w-3 text-[var(--color-text-muted)]" />
}

export function Calendar() {
  const [month, setMonth] = useState(() => new Date())
  const [tasks, setTasks] = useState<(TaskRow & { clients?: { name?: string } | null })[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [filterClient, setFilterClient] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [taskPlatforms, setTaskPlatforms] = useState<TaskPlatformRow[]>([])

  const load = useCallback(async () => {
    if (!supabaseConfigured) return
    const { data: t } = await supabase.from('tasks').select('*, clients(name)')
    setTasks((t as any[]) ?? [])
    const { data: c } = await supabase.from('clients').select('*')
    setClients((c as Client[]) ?? [])
    const { data: tp } = await supabase
      .from('task_platforms')
      .select('*, client_platforms(platform)')
    setTaskPlatforms((tp as TaskPlatformRow[]) ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredTasks = useMemo(() => {
    let list = tasks
    if (filterClient) list = list.filter((t) => t.client_id === filterClient)
    if (filterPlatform) {
      list = list.filter((t) =>
        taskPlatforms.some(tp => tp.task_id === t.id && (tp.client_platforms as any)?.platform === filterPlatform)
      )
    }
    return list
  }, [tasks, filterClient, filterPlatform, taskPlatforms])

  // Full 42-day grid calculation
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month))
    const end = endOfWeek(endOfMonth(month))
    const days = eachDayOfInterval({ start, end })

    // Ensure we always have 42 days for a consistent 7x6 grid
    if (days.length < 42) {
      const lastDay = days[days.length - 1]
      const extra = eachDayOfInterval({
        start: new Date(lastDay.getTime() + 86400000),
        end: new Date(lastDay.getTime() + (42 - days.length) * 86400000)
      })
      return [...days, ...extra]
    }
    return days.slice(0, 42)
  }, [month])

  function tasksOnDay(d: Date) {
    return filteredTasks.filter((t) => {
      const deadline = t.deadline ? isSameDay(parseISO(t.deadline), d) : false
      const publish = t.publish_date ? isSameDay(parseISO(t.publish_date), d) : false
      return deadline || publish
    })
  }

  const handlePrevMonth = () => setMonth(m => subMonths(m, 1))
  const handleNextMonth = () => setMonth(m => addMonths(m, 1))
  const handleToday = () => setMonth(new Date())

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)] lg:text-5xl">Marketing Calendar</h1>
          <p className="mt-3 text-lg font-medium text-[var(--color-text-muted)] opacity-80 leading-relaxed capitalize">
            {format(month, 'MMMM yyyy')} — Task Scheduling
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl bg-[var(--color-surface-2)]/50 p-1 border border-[var(--color-border)]">
            <button
              onClick={handlePrevMonth}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text)] transition-all"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={handleToday}
              className="px-4 text-xs font-black uppercase tracking-widest text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNextMonth}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text)] transition-all"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative group">
          <Filter className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-accent)]" />
          <select
            className="h-11 w-48 appearance-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 pl-11 pr-10 text-sm font-bold text-[var(--color-text)] ring-[var(--color-accent)]/20 transition-all focus:bg-[var(--color-surface)] focus:ring-4 focus:outline-none"
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="relative group">
          <LayoutGrid className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-accent)]" />
          <select
            className="h-11 w-48 appearance-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 pl-11 pr-10 text-sm font-bold text-[var(--color-text)] ring-[var(--color-accent)]/20 transition-all focus:bg-[var(--color-surface)] focus:ring-4 focus:outline-none"
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
          >
            <option value="">All Platforms</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="linkedin">LinkedIn</option>
            <option value="website">Website</option>
          </select>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-[2.5rem] border border-[var(--color-border)] bg-[var(--color-surface-2)]/20 p-4 backdrop-blur-3xl shadow-2xl">
        {/* Weekday Headers */}
        <div className="mb-4 grid grid-cols-7 gap-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] opacity-60">
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-4">
          {calendarDays.map((d) => {
            const inMonth = isSameMonth(d, month)
            const activeToday = isToday(d)
            const dayTasks = tasksOnDay(d)

            return (
              <div
                key={d.toISOString()}
                className={`group relative flex min-h-[140px] flex-col rounded-[2rem] border transition-all duration-300 p-4 ${!inMonth ? 'bg-transparent border-transparent opacity-20' :
                    activeToday ? 'bg-[var(--color-accent)]/5 border-[var(--color-accent)]/40 shadow-[0_0_20px_rgba(var(--color-accent-rgb),0.1)]' :
                      'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-black ${activeToday ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)] opacity-80'}`}>
                    {format(d, 'd')}
                  </span>
                  {activeToday && (
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_rgba(var(--color-accent-rgb),0.8)]" />
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {dayTasks.map((t) => {
                    const platform = taskPlatforms.find(tp => tp.task_id === t.id)?.client_platforms as any
                    return (
                      <div
                        key={t.id}
                        className="group/item flex items-center gap-2 rounded-xl bg-black/20 p-2 transition-all hover:bg-[var(--color-accent)]/20"
                      >
                        <PlatformIcon platform={platform?.platform} />
                        <span className="truncate text-[10px] font-bold text-[var(--color-text)] opacity-90 group-hover/item:text-[var(--color-accent)]">
                          {t.title}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Visual Accent for days with many tasks */}
                {dayTasks.length > 3 && (
                  <div className="mt-auto pt-2 text-[9px] font-black uppercase tracking-widest text-[var(--color-accent)]">
                    +{dayTasks.length - 3} More
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
