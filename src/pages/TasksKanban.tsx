import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Filter, LayoutGrid, ChevronDown, Search, Users } from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer'
import { TalentTasksDrawer } from '@/components/tasks/TalentTasksDrawer'
import type { Client, TaskWithRelations, Profile } from '@/types/db'
import { PLATFORM_LABEL } from '@/lib/constants'
import { logPerformance } from '@/lib/performance'

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

  const load = useCallback(async () => {
    if (!supabaseConfigured) return
    setLoading(true)

    try {
      const [taskRes, subtaskRes, assigneeRes, platformRes, cpRes, clientRes, profileRes] = await Promise.all([
        supabase.from('tasks').select('*, clients(*)').order('updated_at', { ascending: false }),
        supabase.from('subtasks').select('*').order('sort_order'),
        supabase.from('task_assignees').select('*'),
        supabase.from('task_platforms').select('*'),
        supabase.from('client_platforms').select('*'),
        supabase.from('clients').select('*').order('name'),
        supabase.from('profiles').select('*').order('full_name'),
      ])

      setClients((clientRes.data as Client[]) ?? [])
      setProfiles((profileRes.data as Profile[]) ?? [])

      const cpMap = new Map((cpRes.data ?? []).map(cp => [cp.id, cp]))
      const profMap = new Map((profileRes.data ?? []).map(p => [p.id, p]))

      const assembled = (taskRes.data ?? []).map(t => ({
        ...t,
        subtasks: (subtaskRes.data ?? []).filter(s => s.task_id === t.id),
        task_assignees: (assigneeRes.data ?? [])
          .filter(a => a.task_id === t.id)
          .map(a => ({ ...a, profiles: profMap.get(a.user_id) ?? null })),
        task_platforms: (platformRes.data ?? [])
          .filter(tp => tp.task_id === t.id)
          .map(tp => ({ ...tp, client_platforms: cpMap.get(tp.client_platform_id) ?? null })),
      })) as TaskWithRelations[]

      setTasks(assembled)
    } catch (err) {
      console.error('Task load error:', err)
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

    await load()
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 pb-20 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between pt-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-[var(--color-text)] lg:text-5xl">Marketing Canvas</h1>
          <p className="mt-3 text-lg font-medium text-[var(--color-text-muted)] opacity-60 leading-relaxed">
            Coordinating {tasks.filter(t => t.status !== 'completed').length} active production units
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => setOpen(true)}
            className="h-14 rounded-2xl bg-[var(--color-accent)] px-8 font-black uppercase tracking-widest text-white shadow-2xl shadow-[var(--color-accent)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="h-5 w-5" />
            New Tactical Task
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-white/5 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Filter className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <select
              className="h-11 w-44 appearance-none rounded-2xl border border-white/5 bg-white/[0.03] pl-11 pr-10 text-[10px] font-black uppercase tracking-widest text-[var(--color-text)] cursor-pointer focus:bg-[#0B0D13] focus:ring-4 ring-indigo-500/20"
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
            >
              <option value="">All Brands</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)] opacity-40" />
          </div>

          <div className="relative group">
            <LayoutGrid className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <select
              className="h-11 w-44 appearance-none rounded-2xl border border-white/5 bg-white/[0.03] pl-11 pr-10 text-[10px] font-black uppercase tracking-widest text-[var(--color-text)] cursor-pointer focus:bg-[#0B0D13] focus:ring-4 ring-indigo-500/20"
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
            >
              <option value="">Platform Focus</option>
              {Object.entries(PLATFORM_LABEL).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)] opacity-40" />
          </div>

          <div className="relative group">
            <Users className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <select
              className="h-11 w-44 appearance-none rounded-2xl border border-white/5 bg-white/[0.03] pl-11 pr-10 text-[10px] font-black uppercase tracking-widest text-[var(--color-text)] cursor-pointer focus:bg-[#0B0D13] focus:ring-4 ring-indigo-500/20"
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
            >
              <option value="">Collaborator</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)] opacity-40" />
          </div>
        </div>

        <div className="relative group min-w-[340px]">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search production pipeline..."
            className="h-11 w-full rounded-2xl border border-white/5 bg-white/[0.03] pl-11 pr-4 text-[10px] font-black uppercase tracking-widest text-[var(--color-text)] focus:bg-[#0B0D13] focus:ring-4 ring-indigo-500/20 placeholder:text-[#4F5B76]/40"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex py-20 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--color-accent)] border-t-transparent shadow-2xl" />
        </div>
      ) : (
        <div className="py-4">
          <KanbanBoard
            tasks={filtered}
            onStatusChange={onStatusChange}
            onTaskClick={(id) => setSelectedTaskId(id)}
            onTalentClick={(uid) => setSelectedTalentId(uid)}
          />
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
