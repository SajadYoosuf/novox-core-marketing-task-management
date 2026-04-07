import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  Clock,
  FileCheck,
  Camera,
  Briefcase,
  Globe,
  MoreHorizontal,
  Users,
  CheckCircle2,
  Check,
  X
} from 'lucide-react'
import type { Profile } from '@/types/db'
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer'
import { logPerformance } from '@/lib/performance'
import { formatDistanceToNow, parseISO, isBefore } from 'date-fns'

interface DashboardStats {
  total: number
  inProgress: number
  pendingReview: number
  overdue: number
  completed: number
  totalSubtasks: number
  completedSubtasks: number
  totalMembers: number
}

interface ActivityEvent {
  id: string
  user_id?: string
  event: string
  task_id?: string
  timestamp: string
  taskTitle?: string
  userName?: string
  type: 'log' | 'task' | 'subtask'
}

interface EmployeeSnapshot extends Profile {
  score: number
  activeTasks: number
  completed: number
  activeSubtasks: number
  completedSubtasks: number
}

export function Dashboard() {
  const profile = useAuthStore((s) => s.profile)
  const isElevated = useAuthStore((s) => s.isElevated())

  const [stats, setStats] = useState<DashboardStats>({ total: 0, inProgress: 0, pendingReview: 0, overdue: 0, completed: 0, totalSubtasks: 0, completedSubtasks: 0, totalMembers: 0 })
  const [teamSnapshots, setTeamSnapshots] = useState<EmployeeSnapshot[]>([])
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [approvals, setApprovals] = useState<any[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
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
        platformsRes,
        subtasksRes
      ] = await Promise.all([
        supabase.from('tasks').select('id, status, deadline, title, created_at, clients(name)').order('created_at', { ascending: false }).limit(50),
        supabase.from('profiles').select('*'),
        supabase.from('performance_logs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('task_assignees').select('*'),
        supabase.from('task_platforms').select('*'),
        supabase.from('subtasks').select('id, task_id, title, assigned_user_id, is_done').order('sort_order', { ascending: true })
      ])

      const safeTasks = tasksRes.data || []
      const safeProfiles = profilesRes.data || []
      const safeLogs = logsRes.data || []
      const safeAssignees = assigneesRes.data || []
      const safePlatforms = platformsRes.data || []
      const safeSubtasks = subtasksRes.data || []

      // 1. Stats
      const now = new Date()
      setStats({
        total: safeTasks.length,
        inProgress: safeTasks.filter(t => t.status === 'in_progress').length,
        pendingReview: safeTasks.filter(t => t.status === 'review').length,
        overdue: safeTasks.filter(t =>
          t.status !== 'completed' && t.status !== 'approved' &&
          t.deadline && isBefore(parseISO(t.deadline), now)
        ).length,
        completed: safeTasks.filter(t => t.status === 'completed' || t.status === 'approved').length,
        totalSubtasks: safeSubtasks.length,
        completedSubtasks: safeSubtasks.filter(st => st.is_done).length,
        totalMembers: safeProfiles.filter(p => p.role !== 'admin').length
      })

      // 2. Team Snapshots
      const byUser = new Map<string, { completed: number; delayed: number; rejected: number; activeTasks: number; activeSubtasks: number; completedSubtasks: number }>()
      safeProfiles.forEach(p => {
        const userTaskIds = new Set([
          ...safeAssignees.filter(a => a.user_id === p.id).map(a => a.task_id),
          ...safePlatforms.filter(tp => tp.assigned_user_id === p.id).map(tp => tp.task_id),
          ...safeSubtasks.filter(st => st.assigned_user_id === p.id).map(st => st.task_id)
        ])
        
        const activeCount = safeTasks.filter(t =>
          userTaskIds.has(t.id) && 
          t.status !== 'completed' && t.status !== 'approved' && t.status !== 'pending'
        ).length

        const userSubtasks = safeSubtasks.filter(st => st.assigned_user_id === p.id)
        const activeSubtasksCount = userSubtasks.filter(st => !st.is_done).length
        const completedSubtasksCount = userSubtasks.filter(st => st.is_done).length

        byUser.set(p.id, { 
          completed: 0, 
          delayed: 0, 
          rejected: 0, 
          activeTasks: activeCount,
          activeSubtasks: activeSubtasksCount,
          completedSubtasks: completedSubtasksCount
        })
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
          const b = byUser.get(u.id) || { completed: 0, delayed: 0, rejected: 0, activeTasks: 0, activeSubtasks: 0, completedSubtasks: 0 }
          const totalActions = (b.activeTasks + b.completed) + (b.activeSubtasks + b.completedSubtasks)
          const completedActions = b.completed + b.completedSubtasks
          
          // Calculate a percentage-based score (0-100)
          const baseScore = totalActions > 0 ? (completedActions / totalActions) * 100 : 0
          // Apply penalties for rejections or delays if any exist
          const finalScore = Math.max(0, Math.min(100, Math.round(baseScore - (b.delayed * 5) - (b.rejected * 10))))
          
          return {
            ...u,
            score: finalScore,
            activeTasks: b.activeTasks,
            completed: b.completed,
            activeSubtasks: b.activeSubtasks,
            completedSubtasks: b.completedSubtasks
          }
        }).sort((a, b) => b.score - a.score)
      setTeamSnapshots(snapshots)

      // 3. Activity (Merge performance logs, task creation, and subtask assigned)
      const activityEvents: ActivityEvent[] = [
        ...safeLogs.map(l => ({
          id: l.id,
          user_id: l.user_id,
          event: l.event,
          task_id: l.task_id,
          timestamp: l.created_at,
          userName: safeProfiles.find(p => p.id === l.user_id)?.full_name || 'Team member',
          type: 'log' as const
        })),
        ...safeTasks.slice(0, 10).map(t => ({
          id: `task-${t.id}`,
          event: 'New Task Created',
          task_id: t.id,
          taskTitle: t.title,
          timestamp: t.created_at,
          type: 'task' as const
        })),
        ...safeSubtasks.slice(0, 10).map(st => ({
          id: `subtask-${st.id}`,
          user_id: st.assigned_user_id,
          event: 'Subtask Assigned',
          task_id: st.task_id,
          taskTitle: st.title,
          timestamp: (st as any).created_at || (st as any).updated_at || new Date().toISOString(),
          userName: safeProfiles.find(p => p.id === st.assigned_user_id)?.full_name || 'Team member',
          type: 'subtask' as const
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      
      setActivities(activityEvents.slice(0, 8))

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

  const handleApprove = async (taskId: string) => {
    if (!supabaseConfigured) return
    await supabase.from('tasks').update({ status: 'approved' }).eq('id', taskId)
    await logPerformance(profile?.id || '', 'task_completed', taskId)
    void load()
  }

  const handleReject = async (taskId: string) => {
    if (!supabaseConfigured) return
    await supabase.from('tasks').update({ status: 'rejected' }).eq('id', taskId)
    await logPerformance(profile?.id || '', 'task_rejected', taskId)
    void load()
  }

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
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Pending Review</p>
              <h3 className="mt-2 text-4xl font-black text-[var(--color-text)]">{stats.pendingReview}</h3>
            </div>
            <FileCheck className="h-6 w-6 text-purple-500 opacity-20" />
          </div>
          <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            <div className="h-full bg-purple-500" style={{ width: stats.total > 0 ? `${(stats.pendingReview / stats.total) * 100}%` : '0%' }} />
          </div>
        </Card>

        <Card className="group relative overflow-hidden border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 backdrop-blur-xl hover:border-[var(--color-accent)]/30 transition-all">
          <div className="flex justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Completed</p>
              <h3 className="mt-2 text-4xl font-black text-[var(--color-text)]">{stats.completed}</h3>
            </div>
            <CheckCircle2 className="h-6 w-6 text-emerald-500 opacity-20" />
          </div>
          <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            <div className="h-full bg-emerald-500" style={{ width: stats.total > 0 ? `${(stats.completed / stats.total) * 100}%` : '0%' }} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4 flex flex-col border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 backdrop-blur-xl">
          <div className="flex w-full items-center justify-between mb-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-[var(--color-text)]">Task Balance</h2>
            <div className="flex gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </div>
          </div>
          
          <div className="flex flex-1 items-center justify-around gap-4 px-2">
            {/* Task Chart (Big) */}
            <div className="relative flex flex-col items-center">
              <div className="relative h-28 w-28">
                <svg className="h-28 w-28 -rotate-90 transform">
                  <circle cx="56" cy="56" r="48" fill="transparent" stroke="currentColor" strokeWidth="6" className="text-[var(--color-border)] opacity-20" />
                  <circle cx="56" cy="56" r="48" fill="transparent" stroke="var(--color-accent)" strokeWidth="8" strokeDasharray="301" strokeDashoffset={301 * (1 - (stats.total > 0 ? stats.completed / stats.total : 0))} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black text-[var(--color-text)] leading-none">{stats.total}</span>
                  <span className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-tighter">Tasks</span>
                </div>
              </div>
              <p className="mt-2 text-[10px] font-black text-[var(--color-accent)]">{Math.round((stats.completed / (stats.total || 1)) * 100)}%</p>
            </div>

            {/* Subtask Chart (Small) */}
            <div className="relative flex flex-col items-center">
              <div className="relative h-20 w-20">
                <svg className="h-20 w-20 -rotate-90 transform">
                  <circle cx="40" cy="40" r="32" fill="transparent" stroke="currentColor" strokeWidth="5" className="text-[var(--color-border)] opacity-20" />
                  <circle cx="40" cy="40" r="32" fill="transparent" stroke="#10b981" strokeWidth="6" strokeDasharray="201" strokeDashoffset={201 * (1 - (stats.totalSubtasks > 0 ? stats.completedSubtasks / stats.totalSubtasks : 0))} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-black text-[var(--color-text)] leading-none">{stats.totalSubtasks}</span>
                  <span className="text-[7px] font-bold text-[var(--color-text-muted)] uppercase tracking-tighter">Subtasks</span>
                </div>
              </div>
              <p className="mt-2 text-[10px] font-black text-emerald-500">{Math.round((stats.completedSubtasks / (stats.totalSubtasks || 1)) * 100)}%</p>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-4 space-y-8 border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-8 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-[var(--color-text)]">Team Overview</h2>
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
                      <span className="text-[10px] text-[var(--color-text-muted)] font-medium">
                        {ts.completedSubtasks}/{ts.activeSubtasks + ts.completedSubtasks} subtasks done
                      </span>
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
            {activities.map((act) => (
              <div key={act.id} className="relative pl-10">
                <div className={`absolute left-0 top-1 h-6 w-6 rounded-full border-4 border-[var(--color-surface-2)] shadow-sm ${
                  act.type === 'task' ? 'bg-amber-500' : 
                  act.type === 'subtask' ? 'bg-emerald-500' :
                  act.event === 'task_completed' ? 'bg-blue-500' :
                  act.event === 'task_rejected' ? 'bg-rose-500' : 'bg-slate-500'
                }`} />
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)]">{formatDistanceToNow(parseISO(act.timestamp))} ago</p>
                  <p className="text-sm font-bold text-[var(--color-text)] leading-snug">
                    {act.type === 'task' ? `New Task: ${act.taskTitle}` :
                      act.type === 'subtask' ? `Subtask Assigned: ${act.taskTitle}` :
                      act.event === 'task_completed' ? `Task completed by ${act.userName}` :
                      act.event === 'task_rejected' ? `Feedback provided by Head Office` :
                        `${act.userName || 'System'} ${act.event}`}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed opacity-60">
                    {act.type === 'subtask' ? `To ${act.userName}` : 
                     act.type === 'task' ? 'Added to central workflow' :
                     'System Update'}
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
            <h2 className="text-xl font-bold tracking-tight text-[var(--color-text)]">Pending Reviews</h2>
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
                  <p className="text-xs text-[var(--color-text-muted)] opacity-60">Waiting for approval</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(app.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/10"
                    title="Approve"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleReject(app.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-lg shadow-rose-500/10"
                    title="Reject"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedTaskId(app.id)}
                    className="bg-white/5 border-white/10 text-xs px-6 py-2 h-9 rounded-xl font-bold hover:bg-white/10 transition-all ml-2"
                  >
                    Inspect
                  </Button>
                </div>
              </div>
            ))}
            {approvals.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm text-[var(--color-text-muted)] italic">All clear! No tasks waiting for review.</p>
              </div>
            )}
          </div>
        </Card>


      </div>

      <TaskDetailDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={load}
      />
    </div>
  )
}
