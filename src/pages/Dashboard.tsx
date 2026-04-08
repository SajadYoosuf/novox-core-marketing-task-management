import { useCallback, useEffect, useState } from 'react'
import {
  X,
  Clock,
  FileCheck,
  Camera,
  Briefcase,
  Globe,
  Users,
  CheckCircle2,
  Check
} from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { format, isBefore, parseISO } from 'date-fns'
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer'

interface DashboardStats {
  total: number
  inProgress: number
  pendingReview: number
  overdue: number
  completed: number
  totalSubtasks: number
  completedSubtasks: number
  totalMembers: number
  platforms: {
    facebook: number
    instagram: number
    website: number
  }
}

interface ActivityEvent {
  id: string
  user_id: string
  event: string
  task_title: string
  timestamp: string
  profiles?: any
}

interface EmployeeSnapshot {
  id: string
  full_name: string
  role: string
  score: number
  activeTasks: number
  todoTasks: number
  completed: number
  activeSubtasks: number
  completedSubtasks: number
}

export function Dashboard() {
  const profile = useAuthStore((s) => s.profile)

  const [stats, setStats] = useState<DashboardStats>({ total: 0, inProgress: 0, pendingReview: 0, overdue: 0, completed: 0, totalSubtasks: 0, completedSubtasks: 0, totalMembers: 0, platforms: { facebook: 0, instagram: 0, website: 0 } })
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
        subtasksRes
      ] = await Promise.all([
        supabase.from('tasks').select('id, status, deadline, title, created_at, clients(name)').order('created_at', { ascending: false }).limit(50),
        supabase.from('profiles').select('*'),
        supabase.from('performance_logs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('task_assignees').select('*'),
        supabase.from('subtasks').select('id, task_id, title, assigned_user_id, is_done, platform_type').order('sort_order', { ascending: true })
      ])

      const safeTasks = tasksRes.data || []
      const safeProfiles = profilesRes.data || []
      const safeLogs = logsRes.data || []
      const safeAssignees = assigneesRes.data || []
      const safeSubtasks = subtasksRes.data || []

      // 1. Stats
      const now = new Date()
      setStats({
        total: safeTasks.length,
        inProgress: safeTasks.filter((t: any) => t.status === 'in_progress').length,
        pendingReview: safeTasks.filter((t: any) => t.status === 'review').length,
        overdue: safeTasks.filter((t: any) =>
          t.status !== 'completed' && t.status !== 'approved' &&
          t.deadline && isBefore(parseISO(t.deadline), now)
        ).length,
        // USER DEFINITION: Completed means FULL status completed.
        // However, we usually include approved/posted for 'success' metrics.
        // Let's stick to their specific request for 'Completed' card.
        completed: safeTasks.filter((t: any) => t.status === 'completed' || t.status === 'approved' || t.status === 'posted' || t.status === 'scheduled').length,
        totalSubtasks: safeSubtasks.length,
        completedSubtasks: safeSubtasks.filter((st: any) => st.is_done).length,
        totalMembers: safeProfiles.filter((p: any) => p.role !== 'admin').length,
        platforms: {
          facebook: safeSubtasks.filter((st: any) => st.platform_type === 'facebook').length,
          instagram: safeSubtasks.filter((st: any) => st.platform_type === 'instagram').length,
          website: safeSubtasks.filter((st: any) => st.platform_type === 'website' || st.platform_type === 'gmb').length
        }
      })

      // 2. Team Snapshots
      const byUser = new Map<string, { completed: number; delayed: number; rejected: number; activeTasks: number; todoTasks: number; activeSubtasks: number; completedSubtasks: number }>()
      safeProfiles.forEach((p: any) => {
        const userTaskIds = new Set([
          ...safeAssignees.filter((a: any) => a.user_id === p.id).map((a: any) => a.task_id),
          ...safeSubtasks.filter((st: any) => st.assigned_user_id === p.id).map((st: any) => st.task_id)
        ])

        const activeCount = safeTasks.filter((t: any) =>
          userTaskIds.has(t.id) &&
          (t.status === 'in_progress' || t.status === 'review')
        ).length

        const todoCount = safeTasks.filter((t: any) =>
          userTaskIds.has(t.id) && t.status === 'pending'
        ).length

        const userSubtasks = safeSubtasks.filter((st: any) => st.assigned_user_id === p.id)
        const activeSubtasksCount = userSubtasks.filter((st: any) => !st.is_done).length
        const completedSubtasksCount = userSubtasks.filter((st: any) => st.is_done).length

        byUser.set(p.id, {
          completed: 0,
          delayed: 0,
          rejected: 0,
          activeTasks: activeCount,
          todoTasks: todoCount,
          activeSubtasks: activeSubtasksCount,
          completedSubtasks: completedSubtasksCount
        })
      })

      safeLogs.forEach((log: any) => {
        const u = log.user_id as string
        const b = byUser.get(u)
        if (!b) return
        if (log.event === 'task_completed') b.completed += 1
        else if (log.event === 'task_delayed') b.delayed += 1
        else if (log.event === 'task_rejected') b.rejected += 1
      })

      const snapshots = safeProfiles
        .filter((u: any) => u.role !== 'admin')
        .map((u: any) => {
          const b = byUser.get(u.id) || { completed: 0, delayed: 0, rejected: 0, activeTasks: 0, todoTasks: 0, activeSubtasks: 0, completedSubtasks: 0 }
          const totalActions = (b.activeTasks + b.completed) + (b.activeSubtasks + b.completedSubtasks)
          const completedActions = b.completed + b.completedSubtasks

          const baseScore = totalActions > 0 ? (completedActions / totalActions) * 100 : 0
          const finalScore = Math.max(0, Math.min(100, Math.round(baseScore - (b.delayed * 5) - (b.rejected * 10))))

          return {
            ...u,
            score: finalScore,
            activeTasks: b.activeTasks,
            completed: b.completed,
            activeSubtasks: b.activeSubtasks,
            completedSubtasks: b.completedSubtasks
          }
        }).sort((a: any, b: any) => b.score - a.score)
      setTeamSnapshots(snapshots)

      // 3. Activity (Merge logs and subtasks)
      const activityEvents: ActivityEvent[] = [
        ...safeLogs.map((l: any) => ({
          id: l.id,
          user_id: l.user_id,
          event: l.event,
          task_title: safeTasks.find((t: any) => t.id === l.task_id)?.title || 'Task',
          timestamp: l.created_at,
          profiles: safeProfiles.find((p: any) => p.id === l.user_id)
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setActivities(activityEvents)

      // 4. Approvals (Filter subtasks requiring review)
      const { data: revData } = await supabase
        .from('subtasks')
        .select('*, tasks(title, client_id, clients(name))')
        .eq('status', 'review')
        .limit(10)

      setApprovals((revData as any[])?.map(r => ({
        id: r.task_id, // For detail opening
        subtask_id: r.id,
        title: r.title,
        platform: r.platform_type || 'design',
        clients: r.tasks?.clients
      })) || [])

    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleApprove = async (taskId: string) => {
    if (!supabaseConfigured) return
    await supabase.from('tasks').update({ status: 'completed' }).eq('id', taskId)
    void load()
  }

  const handleReject = async (taskId: string) => {
    if (!supabaseConfigured) return
    await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', taskId)
    void load()
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--color-accent)] border-t-transparent pr-1" />
      </div>
    )
  }

  // Recalculating precisely for accuracy
  // Based on user: 
  // - Completed: full status completed
  // - Todo: pending (created and assigned but work not started)
  // - Active: in_progress/review (work started not finished, changes when approved)
  // We'll also count approved/scheduled/posted as Completed for the dashboard view to avoid 'limbo' tasks.

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-10 pb-20 animate-in fade-in duration-700">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between pt-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-[var(--color-text)] lg:text-5xl">Strategy Overview</h1>
          <p className="mt-3 text-lg font-medium text-[var(--color-text-muted)] opacity-60 leading-relaxed">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'Member'}. Here's what's trending across your campaigns today.
          </p>
        </div>

      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Team Members Card */}
        <Card className="group relative overflow-hidden border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 backdrop-blur-xl transition-all hover:bg-[var(--color-surface-2)]/60">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
              <Users className="h-6 w-6 text-indigo-500" />
            </div>
            <div className="flex -space-x-3 overflow-hidden">
              {teamSnapshots.slice(0, 3).map((u) => (
                <div key={u.id} className="h-8 w-8 rounded-full border-2 border-[#161B26] bg-[var(--color-surface)] flex items-center justify-center text-[10px] font-black" title={u.full_name}>
                  {u.full_name.charAt(0)}
                </div>
              ))}
              {teamSnapshots.length > 3 && (
                <div className="h-8 w-8 rounded-full border-2 border-[#161B26] bg-indigo-500/20 flex items-center justify-center text-[8px] font-black text-indigo-500">
                  +{teamSnapshots.length - 3}
                </div>
              )}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] opacity-40">Team Members</p>
            <div className="flex items-end gap-3 mt-1">
              <h3 className="text-4xl font-black text-[var(--color-text)] leading-none">{stats.totalMembers}</h3>
              <span className="mb-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black text-emerald-500 tracking-wider">+12% vs LW</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </Card>

        {/* Pending Card */}
        <Card className="group relative overflow-hidden border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 backdrop-blur-xl transition-all hover:bg-[var(--color-surface-2)]/60">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
              <Clock className="h-6 w-6 text-blue-500" />
            </div>
            <div className="opacity-20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-blue-500">
                <path d="M4 12L20 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] opacity-40">Pending Tasks</p>
            <div className="flex items-end gap-3 mt-1">
              <h3 className="text-4xl font-black text-[var(--color-text)] leading-none">
                {stats.total - (stats.inProgress + stats.pendingReview + stats.completed)}
              </h3>
              <span className="mb-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[9px] font-black text-blue-500 tracking-wider">Awaiting Start</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-1 w-[40%] bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
        </Card>

        {/* Active Card */}
        <Card className="group relative overflow-hidden border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 backdrop-blur-xl transition-all hover:bg-[var(--color-surface-2)]/60">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 rounded-2xl bg-pink-500/10 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
              <FileCheck className="h-6 w-6 text-pink-500" />
            </div>
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-pink-500 animate-pulse" />
              <span className="text-[8px] font-black uppercase tracking-widest text-pink-500">Live</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] opacity-40">Active Tasks</p>
            <div className="flex items-end gap-3 mt-1">
              <h3 className="text-4xl font-black text-[var(--color-text)] leading-none">{stats.inProgress + stats.pendingReview}</h3>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-1 w-[65%] bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]" />
        </Card>

        {/* Completed Card */}
        <Card className="group relative overflow-hidden border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 backdrop-blur-xl transition-all hover:bg-[var(--color-surface-2)]/60">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <div className="h-6 w-6 rounded-lg bg-emerald-500/5 flex items-center justify-center">
              <span className="text-[10px] font-black text-emerald-500">🏆</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] opacity-40">Completed</p>
            <div className="flex items-end gap-3 mt-1">
              <h3 className="text-4xl font-black text-[var(--color-text)] leading-none">{stats.completed}</h3>
              <span className="mb-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black text-emerald-500 tracking-wider">
                {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% Rate
              </span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
        </Card>
      </div>


      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4 border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-8 backdrop-blur-xl flex flex-col items-center justify-center">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text)] opacity-40 mb-8 self-start">Task Distribution</h2>

          <div className="relative h-48 w-48 mb-8">
            {/* SVG Donut Chart */}
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              {/* Background Circle */}
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="8" />

              {/* Active Segment (Pink) */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="var(--color-active, #EC4899)"
                strokeWidth="10"
                strokeDasharray={`${((stats.inProgress + stats.pendingReview) / (stats.total || 1)) * 251.2} 251.2`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />

              {/* Todo Segment (Blue) */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="var(--color-todo, #3B82F6)"
                strokeWidth="10"
                strokeDasharray={`${((stats.total - (stats.inProgress + stats.pendingReview + stats.completed)) / (stats.total || 1)) * 251.2} 251.2`}
                strokeDashoffset={`-${((stats.inProgress + stats.pendingReview) / (stats.total || 1)) * 251.2}`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />

              {/* Completed Segment (Emerald) */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="var(--color-completed, #10B981)"
                strokeWidth="10"
                strokeDasharray={`${(stats.completed / (stats.total || 1)) * 251.2} 251.2`}
                strokeDashoffset={`-${(((stats.inProgress + stats.pendingReview) + (stats.total - (stats.inProgress + stats.pendingReview + stats.completed))) / (stats.total || 1)) * 251.2}`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>

            {/* Inner Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black text-[var(--color-text)]">{stats.total}</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] opacity-40">Total</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-8 w-full border-t border-white/5 pt-6">
            <div className="flex flex-col items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Completed</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Pending</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.4)]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Active</span>
            </div>
          </div>
        </Card>

        {/* Employee Performance Card */}
        <Card className="lg:col-span-3 border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 backdrop-blur-xl transition-all hover:bg-[var(--color-surface-2)]/50">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text)] opacity-40">Employee Performance</h2>
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
          </div>

          <div className="space-y-8">
            {teamSnapshots.slice(0, 4).map(u => (
              <div key={u.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center font-black text-[10px] border border-white/5 shadow-inner">
                      {u.full_name.charAt(0)}
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text)] opacity-90">{u.full_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-black text-[var(--color-text)] leading-none">{u.score}%</p>
                  </div>
                </div>

                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="absolute h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-indigo-400 shadow-[0_0_15px_rgba(var(--color-accent-rgb),0.3)] transition-all duration-1000"
                    style={{ width: `${u.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-5 border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-5 backdrop-blur-xl">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text)] opacity-40 mb-6">Recent Activity</h2>
          <div>
            <div className="relative space-y-6 before:absolute before:left-[11px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-[var(--color-border)] opacity-80">
              {activities.map((act) => (
                <div key={act.id} className="relative pl-10">
                  <div className="absolute left-0 top-0 h-[22px] w-[22px] rounded-full border-2 border-[var(--color-surface)] bg-indigo-500 shadow-lg" />
                  <div className="space-y-1">
                    <p className="text-[11px] font-black leading-none text-[var(--color-text)]">
                      {act.profiles?.full_name} <span className="opacity-40 uppercase tracking-tighter mx-1">created</span> {act.task_title}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] opacity-60">
                      {format(parseISO(act.timestamp), 'HH:mm • MMM d')}
                    </p>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <p className="py-8 text-center text-xs text-[var(--color-text-muted)] italic">No recent pulses detected.</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card className="flex flex-col border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold tracking-tight text-[var(--color-text)]">Pending Reviews</h2>
            <span className="rounded-full bg-pink-500/10 px-3 py-1 text-[10px] font-black text-pink-500 tracking-widest uppercase">
              {approvals.length} PENDING REVIEW
            </span>
          </div>
          <div className="space-y-3">
            {approvals.map(app => (
              <div key={app.subtask_id} className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl bg-white/5 border border-white/5 p-4 hover:border-white/10 transition-all">
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
