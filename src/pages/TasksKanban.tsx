import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Filter, LayoutGrid, ChevronDown, Search, Users } from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import { TaskCard } from '@/components/tasks/TaskCard'
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer'
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
      // Fetch tasks with all relations for the rich Kanban view
      const { data: t, error: tErr } = await supabase
        .from('tasks')
        .select('*, clients(*), task_assignees(*), task_platforms(*, client_platforms(platform)), subtasks(*)')
        .order('updated_at', { ascending: false })

      if (tErr) {
        console.error('Task Fetch Error:', tErr)
        setTasks([])
      } else {
        setTasks((t as TaskWithRelations[]) ?? [])
      }

      const { data: c } = await supabase.from('clients').select('*').order('name')
      setClients((c as Client[]) ?? [])

      const { data: p } = await supabase.from('profiles').select('*').order('full_name')
      setProfiles((p as Profile[]) ?? [])
    } catch (err) {
      console.error('Unexpected Load Error:', err)
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
    <div className="mx-auto w-full max-w-[1400px] space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)] lg:text-5xl">Task Workflow</h1>
          <p className="mt-3 text-lg font-medium text-[var(--color-text-muted)] opacity-80 leading-relaxed">
            Managing {tasks.filter(t => t.status !== 'completed').length} active marketing tasks
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => setOpen(true)}
            className="h-11 rounded-xl bg-[var(--color-accent)] px-6 font-bold text-white shadow-xl shadow-[var(--color-accent)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-b border-white/5 py-8">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group">
            <Filter className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-accent)]" />
            <select
              className="h-11 w-44 appearance-none rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 pl-11 pr-10 text-[11px] font-black uppercase tracking-wider text-[var(--color-text)] ring-[var(--color-accent)]/20 transition-all focus:bg-[var(--color-surface)] focus:ring-4 focus:outline-none cursor-pointer"
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          </div>

          <div className="relative group">
            <LayoutGrid className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-accent)]" />
            <select
              className="h-11 w-44 appearance-none rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 pl-11 pr-10 text-[11px] font-black uppercase tracking-wider text-[var(--color-text)] ring-[var(--color-accent)]/20 transition-all focus:bg-[var(--color-surface)] focus:ring-4 focus:outline-none cursor-pointer"
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
            >
              <option value="">Platforms</option>
              {Object.entries(PLATFORM_LABEL).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          </div>

          <div className="relative group">
            <Users className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-accent)]" />
            <select
              className="h-11 w-44 appearance-none rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 pl-11 pr-10 text-[11px] font-black uppercase tracking-wider text-[var(--color-text)] ring-[var(--color-accent)]/20 transition-all focus:bg-[var(--color-surface)] focus:ring-4 focus:outline-none cursor-pointer"
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
            >
              <option value="">Talent</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          </div>

          {(filterClient || filterPlatform || filterAssignee || searchQuery) && (
            <button 
              onClick={() => { setFilterClient(''); setFilterPlatform(''); setFilterAssignee(''); setSearchQuery(''); }}
              className="text-[10px] font-black uppercase tracking-widest text-[#EE4667] hover:underline underline-offset-4 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="relative group min-w-[340px]">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-accent)]" />
          <input
            type="text"
            placeholder="Search tasks, brands, or production units..."
            className="h-11 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 pl-11 pr-4 text-[11px] font-black uppercase tracking-widest text-[var(--color-text)] ring-[var(--color-accent)]/20 transition-all focus:bg-[var(--color-surface)] focus:ring-4 focus:outline-none placeholder:text-[#4F5B76]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-[400px] w-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex h-[400px] flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/20 p-8 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--color-surface-2)] ring-1 ring-[var(--color-border)]">
             <Plus className="h-10 w-10 text-[var(--color-accent)]/40" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text)]">Establish Your Marketing Pipeline</h2>
          <p className="mt-2 max-w-[400px] text-sm text-[var(--color-text-muted)] font-medium leading-relaxed">
            Your production board is waiting for its first tactical item. Coordinate your talent 
            and define your brand goals across the Marketing Canvas.
          </p>
          <Button 
            onClick={() => setOpen(true)}
            className="mt-8 h-11 rounded-xl bg-[var(--color-accent)] px-8 font-bold text-white shadow-none"
          >
            Create New Task
          </Button>
        </div>
      ) : view === 'kanban' ? (
        <KanbanBoard
          tasks={filtered}
          onStatusChange={onStatusChange}
          onTaskClick={(id) => setSelectedTaskId(id)}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onClick={() => setSelectedTaskId(t.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-20 text-center rounded-[2.5rem] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/20">
              <p className="text-sm font-bold text-[var(--color-text-muted)] italic">No active tasks found matching your filters.</p>
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
    </div>
  )
}
