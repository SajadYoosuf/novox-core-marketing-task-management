import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Card } from '@/components/ui/Card'
import { performanceScore } from '@/lib/constants'
import { ROLE_LABEL } from '@/lib/constants'
import type { Profile } from '@/types/db'

type OutletCtx = { search?: string }

export function Dashboard() {
  const { search = '' } = useOutletContext<OutletCtx>() ?? {}
  const profile = useAuthStore((s) => s.profile)
  const userId = useAuthStore((s) => s.user?.id)
  const isElevated = useAuthStore((s) => s.isElevated())

  const [clientsCount, setClientsCount] = useState(0)
  const [tasksCount, setTasksCount] = useState(0)
  const [myTasks, setMyTasks] = useState(0)
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [platformLoad, setPlatformLoad] = useState<{ platform: string; c: number }[]>([])
  const [teamScores, setTeamScores] = useState<{ user: Profile; score: number; completed: number; delayed: number; rejected: number }[]>([])

  const load = useCallback(async () => {
    if (!supabaseConfigured) return

    const { count: cc } = await supabase.from('clients').select('*', { count: 'exact', head: true })
    setClientsCount(cc ?? 0)

    const { count: tc } = await supabase.from('tasks').select('*', { count: 'exact', head: true })
    setTasksCount(tc ?? 0)

    if (userId) {
      const { count: mc } = await supabase
        .from('task_assignees')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      setMyTasks(mc ?? 0)
    }

    if (isElevated) {
      const { data: reviewTasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('status', 'review')
      setPendingApprovals(reviewTasks?.length ?? 0)
    }

    const { data: tpRows } = await supabase
      .from('task_platforms')
      .select('client_platforms(platform)')
    const map = new Map<string, number>()
    for (const row of tpRows ?? []) {
      const p = (row as { client_platforms?: { platform?: string } | null }).client_platforms?.platform
      if (!p) continue
      map.set(p, (map.get(p) ?? 0) + 1)
    }
    setPlatformLoad([...map.entries()].map(([platform, c]) => ({ platform, c })))

    const { data: profiles } = await supabase.from('profiles').select('*')
    const { data: logs } = await supabase.from('performance_logs').select('*')

    const byUser = new Map<
      string,
      { completed: number; delayed: number; rejected: number }
    >()
    for (const p of profiles ?? []) {
      byUser.set(p.id, { completed: 0, delayed: 0, rejected: 0 })
    }
    for (const log of logs ?? []) {
      const u = log.user_id as string
      if (!byUser.has(u)) byUser.set(u, { completed: 0, delayed: 0, rejected: 0 })
      const b = byUser.get(u)!
      if (log.event === 'task_completed') b.completed += 1
      if (log.event === 'task_delayed') b.delayed += 1
      if (log.event === 'task_rejected') b.rejected += 1
    }

    const scores = (profiles ?? []).map((u) => {
      const b = byUser.get(u.id) ?? { completed: 0, delayed: 0, rejected: 0 }
      return {
        user: u as Profile,
        score: performanceScore(b.completed, b.delayed, b.rejected),
        ...b,
      }
    })
    scores.sort((a, b) => b.score - a.score)
    setTeamScores(scores)
  }, [userId, isElevated])

  useEffect(() => {
    void load()
  }, [load])

  const filteredTeam = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return teamScores
    return teamScores.filter(
      (t) =>
        t.user.full_name.toLowerCase().includes(q) ||
        (t.user.email ?? '').toLowerCase().includes(q),
    )
  }, [teamScores, search])

  const role = profile?.role

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">Dashboard</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {role ? ROLE_LABEL[role] ?? role : 'Team'} view — score formula: (Completed × 2) − Delayed − (Rejected × 2)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {useAuthStore.getState().canManageClients() && (
          <Card>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Clients</p>
            <p className="mt-1 text-3xl font-semibold text-[var(--color-text)]">{clientsCount}</p>
            <Link to="/app/clients" className="mt-2 inline-block text-sm text-[var(--color-accent)]">
              Manage clients
            </Link>
          </Card>
        )}
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">All tasks</p>
          <p className="mt-1 text-3xl font-semibold text-[var(--color-text)]">{tasksCount}</p>
          <Link to="/app/tasks" className="mt-2 inline-block text-sm text-[var(--color-accent)]">
            Open board
          </Link>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">My assignments</p>
          <p className="mt-1 text-3xl font-semibold text-[var(--color-text)]">{myTasks}</p>
        </Card>
        {isElevated && (
          <Card>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Pending approvals</p>
            <p className="mt-1 text-3xl font-semibold text-[var(--color-text)]">{pendingApprovals}</p>
            <Link to="/app/tasks/table" className="mt-2 inline-block text-sm text-[var(--color-accent)]">
              Table view
            </Link>
          </Card>
        )}
      </div>

      {isElevated && platformLoad.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Platform workload</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {platformLoad.map((p) => (
              <Card key={p.platform}>
                <p className="text-xs uppercase text-[var(--color-text-muted)]">{p.platform}</p>
                <p className="text-2xl font-semibold text-[var(--color-text)]">{p.c}</p>
                <p className="text-xs text-[var(--color-text-muted)]">task platforms</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {isElevated && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Team performance</h2>
          <Card className="overflow-x-auto !p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
                <tr>
                  <th className="p-3 font-medium text-[var(--color-text)]">Member</th>
                  <th className="p-3 font-medium text-[var(--color-text)]">Role</th>
                  <th className="p-3 font-medium text-[var(--color-text)]">Completed</th>
                  <th className="p-3 font-medium text-[var(--color-text)]">Delayed</th>
                  <th className="p-3 font-medium text-[var(--color-text)]">Rejected</th>
                  <th className="p-3 font-medium text-[var(--color-text)]">Score</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeam.map((row) => (
                  <tr key={row.user.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="p-3 text-[var(--color-text)]">{row.user.full_name}</td>
                    <td className="p-3 text-[var(--color-text-muted)]">
                      {ROLE_LABEL[row.user.role] ?? row.user.role}
                    </td>
                    <td className="p-3">{row.completed}</td>
                    <td className="p-3">{row.delayed}</td>
                    <td className="p-3">{row.rejected}</td>
                    <td className="p-3 font-semibold text-[var(--color-accent)]">{row.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  )
}
