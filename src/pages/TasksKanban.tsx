import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Filter, LayoutGrid, Search, Users } from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer'
import { TalentTasksDrawer } from '@/components/tasks/TalentTasksDrawer'
import { CustomDropdown } from '@/components/ui/CustomDropdown'
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
      // Fetch core tasks first
      const { data: tasksData, error: tErr } = await supabase
        .from('tasks')
        .select('*, clients(*)')
        .order('updated_at', { ascending: false })

      if (tErr) {
        console.error('Core tasks load failed:', tErr)
        return
      }

      // Fetch supporting data separately to be resilient to schema misses
      const [subtaskRes, assigneeRes, clientRes, profileRes] = await Promise.all([
        supabase.from('subtasks').select('*').order('sort_order'),
        supabase.from('task_assignees').select('*, profiles:user_id(*)'),
        supabase.from('clients').select('*').order('name'),
        supabase.from('profiles').select('*').order('full_name'),
      ])

      if (subtaskRes.error) console.warn('Subtasks load warning:', subtaskRes.error.message)
      if (assigneeRes.error) console.warn('Assignees load warning:', assigneeRes.error.message)

      setClients((clientRes.data as Client[]) ?? [])
      setProfiles((profileRes.data as Profile[]) ?? [])

      const safeSubtasks = subtaskRes.data ?? []
      const safeAssignees = assigneeRes.data ?? []

      const assembled = (tasksData || []).map(t => {
        const tSubtasks = safeSubtasks
          .filter(s => s.task_id === t.id)
          .map(s => ({
            ...s,
            is_platform: !!s.platform_type,
            platform_status: s.status
          }))

        return {
          ...t,
          subtasks: tSubtasks as any,
          task_assignees: safeAssignees.filter(a => a.task_id === t.id),
        }
      }) as TaskWithRelations[]

      setTasks(assembled)
    } catch (err) {
      console.error('Fatal Board load error:', err)
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
      if (filterPlatform === 'creative') {
        list = list.filter((t) =>
          t.subtasks?.some(s => !s.platform_type)
        )
      } else {
        list = list.filter((t) =>
          t.subtasks?.some(s => s.platform_type === filterPlatform)
        )
      }
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
    const prevTask = tasks.find((t) => t.id === taskId)
    if (!prevTask || prevTask.status === status) return

    // Optimistic Update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))

    const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId)
    if (error) {
      console.error('Status update failed:', error)
      alert(`Status update failed: ${error.message}`)
      // Revert on error
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: prevTask.status } : t))
      return
    }

    if (status === 'completed' && prevTask.status !== 'completed') {
      const assignees = prevTask.task_assignees || []
      if (assignees.length) {
        for (const row of assignees) {
          await logPerformance(row.user_id, 'task_completed', taskId)
        }
      } else {
        await logPerformance(userId, 'task_completed', taskId)
      }
    }

    void load()
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-10 pb-20 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between pt-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-[var(--color-text)] lg:text-5xl">Tasks</h1>
          <p className="mt-3 text-lg font-medium text-[var(--color-text-muted)] opacity-60 leading-relaxed">
            Manage your marketing workflow across {clients.length} brands and {profiles.filter(p => p.role !== 'admin').length} team members.
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-white/5 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <CustomDropdown
            options={clients.map(c => ({ id: c.id, name: c.name }))}
            value={filterClient}
            onChange={setFilterClient}
            placeholder="All Brands"
            icon={<Filter className="h-4 w-4" />}
          />

          <CustomDropdown
            options={[
              { id: 'creative', name: 'Creative Design' },
              ...Object.entries(PLATFORM_LABEL || {}).map(([id, name]) => ({ id, name }))
            ]}
            value={filterPlatform}
            onChange={setFilterPlatform}
            placeholder="Platform Focus"
            icon={<LayoutGrid className="h-4 w-4" />}
          />

          <CustomDropdown
            options={profiles.map(p => ({ id: p.id, name: p.full_name }))}
            value={filterAssignee}
            onChange={setFilterAssignee}
            placeholder="Team Member"
            icon={<Users className="h-4 w-4" />}
          />
        </div>

        <div className="relative group min-w-[340px]">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search Tasks..."
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
        <div className="py-4 space-y-4">
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
