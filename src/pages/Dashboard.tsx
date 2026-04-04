import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { performanceScore } from '@/lib/constants'
import {
  Clock,
  FileCheck,
  AlertCircle,
  Camera,
  Briefcase,
  Globe,
  MoreHorizontal,
  Users
} from 'lucide-react'
import type { Profile } from '@/types/db'
import { formatDistanceToNow, parseISO, isBefore } from 'date-fns'

interface DashboardStats {
  total: number
  inProgress: number
  pendingReview: number
  overdue: number
  totalMembers: number
}

interface ActivityEvent {
  id: string
  user_id: string
  event: string
  task_id: string
  timestamp: string
  taskTitle?: string
  userName?: string
}

interface EmployeeSnapshot extends Profile {
  score: number
  activeTasks: number
  completed: number
}

export function Dashboard() {
  const profile = useAuthStore((s) => s.profile)
  const isElevated = useAuthStore((s) => s.isElevated())

  const [stats, setStats] = useState<DashboardStats>({ total: 0, inProgress: 0, pendingReview: 0, overdue: 0, totalMembers: 0 })
  const [teamSnapshots, setTeamSnapshots] = useState<EmployeeSnapshot[]>([])
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [approvals, setApprovals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!supabaseConfigured) return
    setLoading(true)

    try {
      const [
        tasksRes,
        profilesRes,
        logsRes,
        assigneesRes,
        platformsRes
      ] = await Promise.all([
        supabase.from('tasks').select('id, status, deadline, title, clients(name)'),
        supabase.from('profiles').select('*'),
        supabase.from('performance_logs').select('*').order('created_at', { ascending: false }),
        supabase.from('task_assignees').select('*'),
        supabase.from('task_platforms').select('*')
      ])

      const safeTasks = tasksRes.data || []
      const safeProfiles = profilesRes.data || []
      const safeLogs = logsRes.data || []
      const safeAssignees = assigneesRes.data || []
      const safePlatforms = platformsRes.data || []

      // 1. Stats
      const now = new Date()
      setStats({
        total: safeTasks.length,
        inProgress: safeTasks.filter(t => t.status === 'in_progress' || t.status === 'assigned').length,
        pendingReview: safeTasks.filter(t => t.status === 'review').length,
        overdue: safeTasks.filter(t =>
          t.status !== 'completed' && t.status !== 'approved' &&
          t.deadline && isBefore(parseISO(t.deadline), now)
        ).length,
        totalMembers: safeProfiles.filter(p => p.role !== 'admin').length
      })

      // 2. Team Snapshots
      const byUser = new Map<string, { completed: number; delayed: number; rejected: number; activeTasks: number }>()
      safeProfiles.forEach(p => {
        const userTaskIds = new Set([
          ...safeAssignees.filter(a => a.user_id === p.id).map(a => a.task_id),
          ...safePlatforms.filter(tp => tp.assigned_user_id === p.id).map(tp => tp.task_id)
        ])
        const activeCount = safeTasks.filter(t =>
          userTaskIds.has(t.id) && t.status !== 'completed' && t.status !== 'approved'
        ).length
        byUser.set(p.id, { completed: 0, delayed: 0, rejected: 0, activeTasks: activeCount })
      })

      safeLogs.forEach(log => {
        const u = log.user_id as string
        const b = byUser.get(u)
        if (!b) return
        if (log.event === 'task_completed') b.completed += 1
        else if (log.event === 'task_delayed') b.delayed += 1
        else if (log.event === 'task_rejected') b.rejected += 1
      })

      const snapshots = safeProfiles
        .filter(u => u.role !== 'admin')
        .map(u => {
          const b = byUser.get(u.id) || { completed: 0, delayed: 0, rejected: 0, activeTasks: 0 }
          return {
            ...u,
            score: Math.max(0, performanceScore(b.completed, b.delayed, b.rejected)),
            activeTasks: b.activeTasks,
            completed: b.completed
          }
        }).sort((a, b) => b.score - a.score)
      setTeamSnapshots(snapshots)

      // 3. Activity
      const recentLogs = safeLogs.slice(0, 4).map(l => ({
        ...l,
        userName: safeProfiles.find(p => p.id === l.user_id)?.full_name || 'Team member',
        timestamp: l.created_at
      })) as ActivityEvent[]
      setActivities(recentLogs)

      // 4. Approvals
      const reviewTasks = safeTasks.filter(t => t.status === 'review').slice(0, 3)
      if (reviewTasks.length && isElevated) {
        const taskIds = reviewTasks.map(t => t.id)
        const { data: tp } = await supabase
          .from('task_platforms')
          .select('task_id, client_platforms(platform)')
          .in('task_id', taskIds)

        const richApprovals = reviewTasks.map(t => ({
          ...t,
          platform: (tp?.find(p => p.task_id === t.id) as any)?.client_platforms?.platform || 'website'
        }))
        setApprovals(richApprovals)
      }

    } catch (err) {
      console.error('Critical Dashboard Load Error:', err)
    } finally {
      setLoading(false)
    }
  }, [isElevated])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 animate-in fade-in duration-1000">
      {/* Header Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)] lg:text-5xl">Workflow Overview</h1>
          <p className="mt-3 text-lg font-medium text-[var(--color-text-muted)] opacity-80 leading-relaxed">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'Member'}. Monitoring {stats.totalMembers} active team members.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="h-11 rounded-xl bg-white/5 border-white/10 hover:bg-white/10 transition-all font-bold">
            Export Report
          </Button>
          <Button className="h-11 rounded-xl bg-[var(--color-accent)] px-8 font-bold text-white shadow-xl shadow-[var(--color-accent)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
            Q3 Goals
          </Button>
        </div>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="group relative overflow-hidden border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 backdrop-blur-xl hover:border-[var(--color-accent)]/30 transition-all">
          <div className="flex justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Total Team</p>
              <h3 className="mt-2 text-4xl font-black text-[var(--color-text)]">{stats.totalMembers}</h3>
            </div>
            <Users className="h-6 w-6 text-[var(--color-accent)] opacity-20" />
          </div>
          <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            <div className="h-full w-[100%] bg-[var(--color-accent)]" />
          </div>
        </Card>

        <Card className="group relative overflow-hidden border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 backdrop-blur-xl hover:border-[var(--color-accent)]/30 transition-all">
          <div className="flex justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Active Tasks</p>
              <h3 className="mt-2 text-4xl font-black text-[var(--color-text)]">{stats.inProgress}</h3>
            </div>
            <Clock className="h-6 w-6 text-blue-500 opacity-20" />
          </div>
          <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            <div className="h-full w-[65%] bg-blue-500" />
          </div>
        </Card>

        <Card className="group relative overflow-hidden border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 backdrop-blur-xl hover:border-[var(--color-accent)]/30 transition-all">
          <div className="flex justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Approval Pipeline</p>
              <h3 className="mt-2 text-4xl font-black text-[var(--color-text)]">{stats.pendingReview}</h3>
            </div>
            <FileCheck className="h-6 w-6 text-purple-500 opacity-20" />
          </div>
          <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            <div className="h-full w-[45%] bg-purple-500" />
          </div>
        </Card>

        <Card className="group relative overflow-hidden border-rose-500/30 bg-rose-500/5 p-6 backdrop-blur-xl animation-pulse">
          <div className="flex justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-500 underline decoration-rose-500/30">Action Required</p>
              <h3 className="mt-2 text-4xl font-black text-rose-500">{stats.overdue}</h3>
            </div>
            <AlertCircle className="h-6 w-6 text-rose-500" />
          </div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-rose-400">Immediate blockers detected</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4 flex flex-col items-center justify-center space-y-8 border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-10 backdrop-blur-xl">
          <div className="flex w-full items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-[var(--color-text)]">Task Balance</h2>
            <MoreHorizontal className="h-5 w-5 text-[var(--color-text-muted)]" />
          </div>
          <div className="relative flex items-center justify-center">
            <svg className="h-48 w-48 -rotate-90 transform">
              <circle cx="96" cy="96" r="80" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-[var(--color-border)]" />
              <circle cx="96" cy="96" r="80" fill="transparent" stroke="var(--color-accent)" strokeWidth="14" strokeDasharray="502" strokeDashoffset={502 * (1 - 0.6)} strokeLinecap="round" />
              <circle cx="96" cy="96" r="80" fill="transparent" stroke="#ec4899" strokeWidth="14" strokeDasharray="502" strokeDashoffset={502 * (1 - 0.15)} strokeLinecap="round" />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-black text-[var(--color-text)]">{stats.total}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Tasks</span>
            </div>
          </div>
          <div className="flex w-full justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Done</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-pink-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Wait</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Active</span>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-4 space-y-8 border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-8 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-[var(--color-text)]">Team Synchronization</h2>
            <div className="rounded-lg bg-white/5 px-3 py-1.5 text-[10px] font-bold text-[var(--color-text-muted)] border border-white/5">
              REAL-TIME
            </div>
          </div>
          <div className="space-y-6 overflow-y-auto max-h-[350px] scrollbar-hide pr-2">
            {teamSnapshots.map(ts => (
              <div key={ts.id} className="space-y-3 p-3 rounded-2xl transition-all hover:bg-white/5 bg-white/[0.02] cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full border border-white/10 bg-[var(--color-surface)] flex items-center justify-center text-[10px] font-black">
                      {ts.full_name.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-tight">{ts.full_name}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] font-medium">{ts.activeTasks} active tasks</span>
                    </div>
                  </div>
                  <span className="text-xs font-black text-[var(--color-accent)]">{ts.score}%</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700" style={{ width: `${ts.score}%` }} />
                </div>
              </div>
            ))}
            {teamSnapshots.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-xs text-[var(--color-text-muted)] italic">No non-admin team members found.</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-4 space-y-8 border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-8 backdrop-blur-xl">
          <h2 className="text-xl font-bold tracking-tight text-[var(--color-text)]">Recent Activity</h2>
          <div className="relative space-y-8 before:absolute before:left-[11px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-[var(--color-border)]">
            {activities.map((act, i) => (
              <div key={act.id} className="relative pl-10">
                <div className={`absolute left-0 top-1 h-6 w-6 rounded-full border-4 border-[var(--color-surface-2)] shadow-sm ${i === 0 ? 'bg-indigo-500' : i === 1 ? 'bg-pink-500' : 'bg-slate-500'}`} />
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)]">{formatDistanceToNow(parseISO(act.timestamp))} ago</p>
                  <p className="text-sm font-bold text-[var(--color-text)] leading-snug">
                    {act.event === 'task_completed' ? `Task mission finalized by ${act.userName}` :
                      act.event === 'task_rejected' ? `Feedback provided by Head Office` :
                        `${act.userName} updated task status`}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed opacity-60">
                    Synchronized with MarketingOS Task Core.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-3 space-y-6 border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-8 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-[var(--color-text)]">Deliverable Pipeline</h2>
            <span className="rounded-full bg-pink-500/10 px-3 py-1 text-[10px] font-black text-pink-500 tracking-widest uppercase">
              {approvals.length} PENDING REVIEW
            </span>
          </div>
          <div className="space-y-4">
            {approvals.map(app => (
              <div key={app.id} className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl bg-white/5 border border-white/5 p-4 hover:border-white/10 transition-all">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-surface)] flex items-center justify-center shadow-lg">
                  {app.platform === 'instagram' ? <Camera className="h-6 w-6 text-pink-500" /> :
                    app.platform === 'linkedin' ? <Briefcase className="h-6 w-6 text-blue-500" /> :
                      <Globe className="h-6 w-6 text-[var(--color-accent)]" />}
                </div>
                <div className="flex-1 text-center sm:text-left space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-[10px] font-black text-pink-500 uppercase tracking-widest px-2 py-0.5 rounded bg-pink-500/10 mb-1 sm:mb-0">
                      {app.platform.toUpperCase()}
                    </span>
                    <h4 className="font-bold text-[var(--color-text)]">{app.clients?.name} - {app.title}</h4>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] opacity-60">Task quality check passed • Syncing...</p>
                </div>
                <Button variant="secondary" className="bg-white/5 border-white/10 text-xs px-6 py-2 h-9 rounded-xl font-bold hover:bg-white/10 transition-all">
                  Inspect
                </Button>
              </div>
            ))}
            {approvals.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm text-[var(--color-text-muted)] italic">Pipeline clear. No pending reviews detected.</p>
              </div>
            )}
          </div>
        </Card>


      </div>
    </div>
  )
}
