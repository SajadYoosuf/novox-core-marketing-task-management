import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Filter, LayoutGrid, ChevronDown, Search, Users } from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import { TaskCard } from '@/components/tasks/TaskCard'
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer'
import { TalentTasksDrawer } from '@/components/tasks/TalentTasksDrawer'
import type { Client, TaskWithRelations, Profile } from '@/types/db'
import { PLATFORM_LABEL } from '@/lib/constants'
import { logPerformance, insertNotification } from '@/lib/performance'

export function TasksKanban() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [open, setOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedTalentId, setSelectedTalentId] = useState<string | null>(null)
  const [filterClient, setFilterClient] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [view] = useState<'kanban' | 'grid'>('kanban')

  const load = useCallback(async () => {
    if (!supabaseConfigured) return
    setLoading(true)

    try {
      console.log('📡 Fetching tasks from Marketing Core...')
      // Simplified fetcher for absolute reliability
      const { data: t, error: tErr } = await supabase
        .from('tasks')
        .select(`
          *,
          clients(*),
          task_assignees(*, profiles(*)),
          task_platforms(*, client_platforms(platform)),
          subtasks(*, client_platforms(platform), profiles:assigned_user_id(*))
        `)
        .order('updated_at', { ascending: false })

      if (tErr) {
        console.error('❌ Task Fetch Error:', tErr)
        // Fallback to simple task fetch if complex join fails
        const { data: simpleT } = await supabase.from('tasks').select('*, clients(*)').order('updated_at', { ascending: false })
        setTasks((simpleT as TaskWithRelations[]) ?? [])
      } else {
        console.log(`✅ Sync Complete: ${t?.length || 0} tasks retrieved.`)
        setTasks((t as TaskWithRelations[]) ?? [])
      }

      const { data: c } = await supabase.from('clients').select('*').order('name')
      setClients((c as Client[]) ?? [])

      const { data: p } = await supabase.from('profiles').select('*').order('full_name')
      setProfiles((p as Profile[]) ?? [])
    } catch (err) {
      console.error('⚠️ Unexpected Operational Error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    let list = tasks
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.clients?.name?.toLowerCase().includes(q) ||
        t.subtasks?.some(s => s.title.toLowerCase().includes(q))
      )
    }
    if (filterClient) list = list.filter((t) => t.client_id === filterClient)
    if (filterPlatform) {
      list = list.filter((t) =>
        t.subtasks?.some(s => (s as any).client_platforms?.platform === filterPlatform) ||
        t.task_platforms?.some(tp => (tp.client_platforms as any)?.platform === filterPlatform)
      )
    }
    if (filterAssignee) {
      list = list.filter((t) => 
        t.task_assignees?.some(a => a.user_id === filterAssignee) ||
        t.subtasks?.some(s => s.assigned_user_id === filterAssignee)
      )
    }
    return list
  }, [tasks, filterClient, filterPlatform, filterAssignee, searchQuery])

  async function onStatusChange(taskId: string, status: TaskWithRelations['status']) {
    if (!supabaseConfigured || !userId) return
    const prev = tasks.find((t) => t.id === taskId)
    await supabase.from('tasks').update({ status }).eq('id', taskId)

    if (status === 'completed' && prev?.status !== 'completed') {
      const assignees = prev?.task_assignees || []
      if (assignees.length) {
        for (const row of assignees) {
          await logPerformance(row.user_id, 'task_completed', taskId)
        }
      } else {
        await logPerformance(userId, 'task_completed', taskId)
      }
    }
    if (status === 'rejected' && prev?.status !== 'rejected') {
      for (const row of (prev?.task_assignees || [])) {
        await logPerformance(row.user_id, 'task_rejected', taskId)
      }
    }

    const notifyIds = new Set((prev?.task_assignees || []).map((r) => r.user_id))
    for (const uid of notifyIds) {
      if (uid !== userId) {
        await insertNotification(uid, 'Task status updated', `Moved to ${status}`, 'status_changed', taskId)
      }
    }

    await load()
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] flex flex-col h-[calc(100vh-64px)] overflow-hidden space-y-6 lg:space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between shrink-0 pt-4 lg:pt-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-[var(--color-text)] lg:text-5xl">Task Workflow</h1>
          <p className="mt-3 text-lg font-medium text-[var(--color-text-muted)] opacity-60 leading-relaxed">
            Managing {tasks.filter(t => t.status !== 'completed').length} active marketing tasks
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => setOpen(true)}
            className="h-14 rounded-2xl bg-[var(--color-accent)] px-8 font-black uppercase tracking-widest text-white shadow-2xl shadow-[var(--color-accent)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="h-5 w-5" />
            New Task
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-white/5 pt-6 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Filter className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-accent)] transition-colors" />
            <select
              className="h-11 w-44 appearance-none rounded-2xl border border-white/5 bg-white/[0.03] pl-11 pr-10 text-[10px] font-black uppercase tracking-widest text-[var(--color-text)] ring-[var(--color-accent)]/20 transition-all focus:bg-[#0B0D13] focus:ring-4 focus:outline-none cursor-pointer"
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)] op-40" />
          </div>

          <div className="relative group">
            <LayoutGrid className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-accent)] transition-colors" />
            <select
              className="h-11 w-44 appearance-none rounded-2xl border border-white/5 bg-white/[0.03] pl-11 pr-10 text-[10px] font-black uppercase tracking-widest text-[var(--color-text)] ring-[var(--color-accent)]/20 transition-all focus:bg-[#0B0D13] focus:ring-4 focus:outline-none cursor-pointer"
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
            >
              <option value="">Platforms</option>
              {Object.entries(PLATFORM_LABEL).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)] op-40" />
          </div>

          <div className="relative group">
            <Users className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-accent)] transition-colors" />
            <select
              className="h-11 w-44 appearance-none rounded-2xl border border-white/5 bg-white/[0.03] pl-11 pr-10 text-[10px] font-black uppercase tracking-widest text-[var(--color-text)] ring-[var(--color-accent)]/20 transition-all focus:bg-[#0B0D13] focus:ring-4 focus:outline-none cursor-pointer"
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
            >
              <option value="">Talent</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)] op-40" />
          </div>

          {(filterClient || filterPlatform || filterAssignee || searchQuery) && (
            <button 
              onClick={() => { setFilterClient(''); setFilterPlatform(''); setFilterAssignee(''); setSearchQuery(''); }}
              className="text-[9px] font-black uppercase tracking-[0.2em] text-[#EE4667] hover:underline underline-offset-4 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="relative group min-w-[340px]">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-accent)] transition-colors" />
          <input
            type="text"
            placeholder="Search production pipeline..."
            className="h-11 w-full rounded-2xl border border-white/5 bg-white/[0.03] pl-11 pr-4 text-[10px] font-black uppercase tracking-widest text-[var(--color-text)] ring-[var(--color-accent)]/20 transition-all focus:bg-[#0B0D13] focus:ring-4 focus:outline-none placeholder:text-[#4F5B76]/40"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--color-accent)] border-t-transparent shadow-2xl" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-[3.5rem] border border-dashed border-white/5 bg-white/[0.01] p-12 text-center my-8">
          <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-white/[0.02] ring-1 ring-white/5 shadow-2xl">
             <Plus className="h-12 w-12 text-[var(--color-accent)]/40" />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight">Establish Your Marketplace Pipeline</h2>
          <p className="mt-4 max-w-[460px] text-base text-[var(--color-text-muted)] font-medium leading-relaxed opacity-60">
            Your production board is waiting for its first tactical unit. Coordinate your talent 
            and define your brand goals across the Marketing Canvas.
          </p>
          <Button 
            onClick={() => setOpen(true)}
            className="mt-10 h-16 rounded-2xl bg-[#3A49F9] px-12 font-black uppercase tracking-[0.25em] text-white shadow-2xl shadow-[#3A49F9]/20"
          >
            Create New Task
          </Button>
        </div>
      ) : view === 'kanban' ? (
        <div className="flex-1 min-h-0 py-4">
          <KanbanBoard
            tasks={filtered}
            onStatusChange={onStatusChange}
            onTaskClick={(id) => setSelectedTaskId(id)}
            onTalentClick={(uid) => setSelectedTalentId(uid)}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide py-4 pr-1">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onClick={() => setSelectedTaskId(t.id)}
                onTalentClick={(uid) => setSelectedTalentId(uid)}
              />
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="py-20 text-center rounded-[3rem] border border-dashed border-white/5 bg-white/[0.01]">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#4F5B76] italic opacity-40">Operational Void: No tasks match these filters.</p>
            </div>
          )}
        </div>
      )}

      <CreateTaskModal open={open} onClose={() => setOpen(false)} userId={userId} onCreated={load} />

      <TaskDetailDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={load}
      />

      <TalentTasksDrawer
        userId={selectedTalentId}
        onClose={() => setSelectedTalentId(null)}
        onTaskClick={(tid) => {
          setSelectedTalentId(null)
          setSelectedTaskId(tid)
        }}
      />
    </div>
  )
}
