import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'
import type { Client, Profile, TaskRow, TaskPlatformRow } from '@/types/db'
import { logPerformance } from '@/lib/performance'
import { insertNotification } from '@/lib/performance'

type TaskAssigneeRow = { task_id: string; user_id: string }

export function TasksKanban() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id
  const [tasks, setTasks] = useState<(TaskRow & { clients?: { name?: string } | null })[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [taskPlatforms, setTaskPlatforms] = useState<TaskPlatformRow[]>([])
  const [assigneeRows, setAssigneeRows] = useState<TaskAssigneeRow[]>([])
  const [open, setOpen] = useState(false)
  const [filterClient, setFilterClient] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')

  const load = useCallback(async () => {
    if (!supabaseConfigured) return
    const { data: t } = await supabase.from('tasks').select('*, clients(name)').order('updated_at', { ascending: false })
    setTasks((t as typeof tasks) ?? [])
    const { data: c } = await supabase.from('clients').select('*').order('name')
    setClients((c as Client[]) ?? [])
    const { data: p } = await supabase.from('profiles').select('*').order('full_name')
    setProfiles((p as Profile[]) ?? [])
    const { data: tp } = await supabase.from('task_platforms').select('*, client_platforms(platform)')
    setTaskPlatforms((tp as TaskPlatformRow[]) ?? [])
    const { data: ta } = await supabase.from('task_assignees').select('task_id, user_id')
    setAssigneeRows((ta as TaskAssigneeRow[]) ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    let list = tasks
    if (filterClient) list = list.filter((t) => t.client_id === filterClient)
    if (filterUser) {
      list = list.filter(
        (t) =>
          assigneeRows.some((r) => r.task_id === t.id && r.user_id === filterUser) ||
          taskPlatforms.some((tp) => tp.task_id === t.id && tp.assigned_user_id === filterUser),
      )
    }
    if (filterPlatform) {
      list = list.filter((t) =>
        taskPlatforms.some(
          (x) =>
            x.task_id === t.id &&
            (x.client_platforms as { platform?: string } | null)?.platform === filterPlatform,
        ),
      )
    }
    return list
  }, [tasks, filterClient, filterUser, filterPlatform, taskPlatforms, assigneeRows])

  async function onStatusChange(taskId: string, status: TaskRow['status']) {
    if (!supabaseConfigured || !userId) return
    const prev = tasks.find((t) => t.id === taskId)
    await supabase.from('tasks').update({ status }).eq('id', taskId)

    if (status === 'completed' && prev?.status !== 'completed') {
      const rows = assigneeRows.filter((r) => r.task_id === taskId)
      if (rows.length) {
        for (const row of rows) {
          await logPerformance(row.user_id, 'task_completed', taskId)
        }
      } else {
        await logPerformance(userId, 'task_completed', taskId)
      }
    }
    if (status === 'rejected' && prev?.status !== 'rejected') {
      for (const row of assigneeRows.filter((r) => r.task_id === taskId)) {
        await logPerformance(row.user_id, 'task_rejected', taskId)
      }
    }

    const notifyIds = new Set(assigneeRows.filter((r) => r.task_id === taskId).map((r) => r.user_id))
    for (const uid of notifyIds) {
      if (uid !== userId) {
        await insertNotification(uid, 'Task status updated', `Moved to ${status}`, 'status_changed', taskId)
      }
    }

    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">Tasks</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Drag cards across columns to update status</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          New task
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
        >
          <option value="">All assignees</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
        >
          <option value="">All platforms</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="linkedin">LinkedIn</option>
          <option value="gmb">GMB</option>
          <option value="website">Website</option>
        </select>
      </div>

      <KanbanBoard tasks={filtered} onStatusChange={onStatusChange} />
      <CreateTaskModal open={open} onClose={() => setOpen(false)} userId={userId} onCreated={load} />
    </div>
  )
}
