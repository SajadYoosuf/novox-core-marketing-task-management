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

import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer'
import { Modal } from '@/components/ui/Modal'
import { Plus } from 'lucide-react'

export function Calendar() {
  const [month, setMonth] = useState(() => new Date())
  const [tasks, setTasks] = useState<(TaskRow & { clients?: { name?: string } | null })[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [filterClient, setFilterClient] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [taskPlatforms, setTaskPlatforms] = useState<TaskPlatformRow[]>([])
  
  // Interaction State
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null)

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

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month))
    const end = endOfWeek(endOfMonth(month))
    const days = eachDayOfInterval({ start, end })

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

  const selectedDayTasks = selectedDay ? tasksOnDay(selectedDay) : []

  const handlePrevMonth = () => setMonth(m => subMonths(m, 1))
  const handleNextMonth = () => setMonth(m => addMonths(m, 1))
  const handleToday = () => setMonth(new Date())

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)] lg:text-5xl">Marketing Calendar</h1>
          <p className="text-lg font-medium text-[var(--color-text-muted)] opacity-80 leading-relaxed capitalize">
            {format(month, 'MMMM yyyy')} — Global Workflow View
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-2xl bg-white/5 p-1 border border-white/5 backdrop-blur-xl">
            <button onClick={handlePrevMonth} className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:bg-white/5 hover:text-white transition-all transform hover:scale-105">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={handleToday} className="px-6 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:text-[var(--color-accent)] transition-colors">
              Today
            </button>
            <button onClick={handleNextMonth} className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:bg-white/5 hover:text-white transition-all transform hover:scale-105">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative group">
          <Filter className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-accent)]" />
          <select
            className="h-12 w-52 appearance-none rounded-2xl border border-white/5 bg-white/5 pl-11 pr-10 text-xs font-black uppercase tracking-widest text-white ring-[var(--color-accent)]/20 transition-all focus:bg-white/10 focus:ring-4 focus:outline-none backdrop-blur-xl"
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
          >
            <option value="" className="bg-[var(--color-surface)]">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id} className="bg-[var(--color-surface)]">{c.name}</option>
            ))}
          </select>
        </div>

        <div className="relative group">
          <LayoutGrid className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-accent)]" />
          <select
            className="h-12 w-52 appearance-none rounded-2xl border border-white/5 bg-white/5 pl-11 pr-10 text-xs font-black uppercase tracking-widest text-white ring-[var(--color-accent)]/20 transition-all focus:bg-white/10 focus:ring-4 focus:outline-none backdrop-blur-xl"
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
          >
            <option value="" className="bg-[var(--color-surface)]">All Platforms</option>
            <option value="instagram" className="bg-[var(--color-surface)]">Instagram</option>
            <option value="facebook" className="bg-[var(--color-surface)]">Facebook</option>
            <option value="linkedin" className="bg-[var(--color-surface)]">LinkedIn</option>
            <option value="website" className="bg-[var(--color-surface)]">Website</option>
          </select>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-[3rem] border border-white/5 bg-white/[0.02] p-8 backdrop-blur-3xl shadow-2xl overflow-hidden relative">
        <div className="mb-6 grid grid-cols-7 gap-6">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-[11px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] opacity-50">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-6">
          {calendarDays.map((d) => {
            const inMonth = isSameMonth(d, month)
            const activeToday = isToday(d)
            const dayTasks = tasksOnDay(d)

            return (
              <div
                key={d.toISOString()}
                onClick={() => setSelectedDay(d)}
                className={`group relative flex min-h-[160px] flex-col rounded-[2.5rem] border transition-all duration-500 p-5 cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${!inMonth ? 'bg-transparent border-transparent opacity-10 cursor-default' :
                    activeToday ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/80 shadow-[0_20px_50px_rgba(var(--color-accent-rgb),0.1)]' :
                      'bg-white/[0.04] border-white/5 hover:bg-white/10 hover:border-white/20 hover:shadow-2xl'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-base font-black ${activeToday ? 'text-white' : 'text-white/60'}`}>
                    {format(d, 'd')}
                  </span>
                  {activeToday && (
                    <div className="h-2 w-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_15px_rgba(var(--color-accent-rgb),0.8)]" />
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  {dayTasks.slice(0, 3).map((t) => {
                    const platform = taskPlatforms.find(tp => tp.task_id === t.id)?.client_platforms as any
                    return (
                      <div key={t.id} className="flex h-7 items-center gap-2 rounded-xl bg-white/5 px-3 transition-opacity">
                        <PlatformIcon platform={platform?.platform} />
                        <span className="truncate text-[10px] font-black uppercase tracking-tighter text-white/80">
                          {t.title}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {dayTasks.length > 3 && (
                  <div className="mt-auto pt-3 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--color-accent)]">
                    <div className="h-1 w-1 rounded-full bg-[var(--color-accent)]" />
                    +{dayTasks.length - 3} Units
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Day Overview Modal */}
      <Modal 
        open={!!selectedDay} 
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? format(selectedDay, 'EEEE, MMMM d') : ''}
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 scrollbar-hide py-2">
          {selectedDayTasks.length > 0 ? (
            <div className="grid gap-4">
              {selectedDayTasks.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setViewingTaskId(t.id)
                    setSelectedDay(null)
                  }}
                  className="flex items-center justify-between rounded-[2rem] border border-white/5 bg-white/5 p-6 text-left transition-all hover:bg-white/10 hover:border-[var(--color-accent)]/40 hover:scale-[1.01] active:scale-[0.99] group"
                >
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-accent)]">
                      {t.clients?.name || 'SYNCING...'}
                    </p>
                    <h3 className="text-xl font-black text-white group-hover:text-[var(--color-accent)] transition-colors line-clamp-1">
                      {t.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-xl px-4 py-1.5 text-[10px] font-black uppercase tracking-widest border border-white/10 ${
                      t.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 
                      t.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-white/40'
                    }`}>
                      {t.status}
                    </span>
                    <Plus className="h-5 w-5 text-white/20 group-hover:text-white transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="h-20 w-20 rounded-[2.5rem] bg-white/5 flex items-center justify-center">
                <LayoutGrid className="h-8 w-8 text-white/10" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-white/60">No tasks scheduled</p>
                <p className="text-xs text-white/30 mt-1">Select another day or add a new task</p>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Task Detail Integration */}
      <TaskDetailDrawer 
        taskId={viewingTaskId}
        onClose={() => setViewingTaskId(null)}
        onUpdate={load}
      />
    </div>
  )
}
