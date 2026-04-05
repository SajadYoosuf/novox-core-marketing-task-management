import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge, PlatformBadge } from '@/components/ui/Badge'
import { TextArea } from '@/components/ui/Input'
import { PLATFORM_ICON, PLATFORM_LABEL, TASK_CONTENT_TYPES, TASK_CONTENT_TYPE_LABELS } from '@/lib/constants'
import type { TaskContentType } from '@/lib/constants'
import type {
  Comment,
  Profile,
  Subtask,
  TaskPlatformRow,
  TaskRow,
} from '@/types/db'
import { nextPlatformStatus, previousPlatformStatus } from '@/lib/taskWorkflow'
import { format } from 'date-fns'
import { insertNotification, logPerformance } from '@/lib/performance'

export function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const userId = useAuthStore((s) => s.user?.id)
  const profile = useAuthStore((s) => s.profile)
  const isElevated = useAuthStore((s) => s.isElevated())

  const [task, setTask] = useState<TaskRow | null>(null)
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [platforms, setPlatforms] = useState<TaskPlatformRow[]>([])

  const [comments, setComments] = useState<Comment[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [rejectOpen, setRejectOpen] = useState<string | null>(null)
  const [rejectText, setRejectText] = useState('')

  const load = useCallback(async () => {
    if (!supabaseConfigured || !id) return
    const { data: t } = await supabase.from('tasks').select('*, clients(name)').eq('id', id).maybeSingle()
    setTask(t as TaskRow)
    const { data: st } = await supabase.from('subtasks').select('*').eq('task_id', id).order('sort_order')
    setSubtasks((st as Subtask[]) ?? [])
    const { data: tp } = await supabase.from('task_platforms').select('*, client_platforms(platform)').eq('task_id', id)
    setPlatforms((tp as TaskPlatformRow[]) ?? [])
    const { data: cm } = await supabase
      .from('comments')
      .select('*, profiles(full_name)')
      .eq('task_id', id)
      .order('created_at', { ascending: false })
    setComments((cm as Comment[]) ?? [])
    const { data: pr } = await supabase.from('profiles').select('*').order('full_name')
    setProfiles((pr as Profile[]) ?? [])
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleSubtask(st: Subtask) {
    if (!supabaseConfigured) return
    await supabase.from('subtasks').update({ is_done: !st.is_done }).eq('id', st.id)
    await load()
  }

  const allSubtasksDone = subtasks.length > 0 && subtasks.every((s) => s.is_done)

  async function assignPlatform(tpId: string, assignee: string) {
    if (!supabaseConfigured) return
    await supabase.from('task_platforms').update({ assigned_user_id: assignee || null }).eq('id', tpId)
    if (assignee) {
      await insertNotification(assignee, 'Platform assigned', 'You were assigned to a platform task.', 'task_assigned', id!)
      await logPerformance(assignee, 'task_assigned', id!, tpId)
    }
    await load()
  }


  async function advancePlatform(tp: TaskPlatformRow) {
    if (!supabaseConfigured) return
    const next = nextPlatformStatus(tp.status)
    if (!next) return
    await supabase.from('task_platforms').update({ status: next }).eq('id', tp.id)
    const assignee = tp.assigned_user_id
    if (assignee) {
      await insertNotification(assignee, 'Platform status', `Now in ${next}`, 'platform_status_changed', id!)
    }
    await load()
  }

  async function rejectPlatform(tp: TaskPlatformRow) {
    if (!supabaseConfigured || !userId || !rejectText.trim()) return
    const prev = previousPlatformStatus(tp.status) ?? 'in_progress'
    await supabase.from('comments').insert({
      task_platform_id: tp.id,
      task_id: id!,
      body: rejectText.trim(),
      is_rejection: true,
      created_by: userId,
    })
    await supabase.from('task_platforms').update({ status: prev }).eq('id', tp.id)
    if (tp.assigned_user_id) {
      await logPerformance(tp.assigned_user_id, 'task_rejected', id!, tp.id)
      await insertNotification(tp.assigned_user_id, 'Rejected with feedback', rejectText, 'status_changed', id!)
    }
    setRejectOpen(null)
    setRejectText('')
    await load()
  }

  async function marketingApprove(tp: TaskPlatformRow) {
    if (!isElevated) return
    if (!supabaseConfigured) return
    await supabase.from('task_platforms').update({ status: 'approved' }).eq('id', tp.id)
    await load()
  }

  async function completeTask() {
    if (!supabaseConfigured || !task) return
    if (!allSubtasksDone) {
      alert('Complete all subtasks before marking the task completed.')
      return
    }
    const pending = platforms.filter((p) => p.status !== 'completed' && p.status !== 'approved')
    if (pending.length) {
      const ok = confirm('Some platform rows are not approved/completed. Complete anyway?')
      if (!ok) return
    }
    await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id)
    await load()
  }

  async function postComment() {
    if (!supabaseConfigured || !userId || !commentBody.trim() || !id) return
    await supabase.from('comments').insert({
      task_id: id,
      body: commentBody.trim(),
      created_by: userId,
    })
    setCommentBody('')
    await load()
  }
  
  async function updateContentType(type: string) {
    if (!supabaseConfigured || !id) return
    await supabase.from('tasks').update({ content_type: type }).eq('id', id)
    await load()
  }

  if (!task) {
    return (
      <p className="text-[var(--color-text-muted)]">
        Loading… <Link to="/app/tasks">Back</Link>
      </p>
    )
  }

  const clientName = (task as TaskRow & { clients?: { name?: string } }).clients?.name

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/app/tasks" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)]">
        ← Tasks
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-[var(--color-text)]">{task.title}</h1>
            <span className="rounded bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
              {TASK_CONTENT_TYPE_LABELS[task.content_type as TaskContentType] || 'Static Post'}
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] font-medium">{clientName}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-medium focus:ring-2 focus:ring-[var(--color-accent)]"
            value={task.content_type || 'static'}
            onChange={(e) => void updateContentType(e.target.value)}
          >
            {TASK_CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TASK_CONTENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <StatusBadge status={task.status} />
        </div>
      </div>
      <p className="text-sm leading-relaxed text-[var(--color-text)]">{task.description || 'No description provided.'}</p>
      <div className="flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)]">
        {task.deadline ? <span>Deadline: {format(new Date(task.deadline), 'PPp')}</span> : null}
        {task.publish_date ? <span>Publish: {format(new Date(task.publish_date), 'PPp')}</span> : null}
        <span className="capitalize">Priority: {task.priority}</span>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Subtasks</h2>
        {!subtasks.length ? <p className="text-sm text-[var(--color-text-muted)]">No subtasks.</p> : null}
        <ul className="space-y-2">
          {subtasks.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.is_done} onChange={() => void toggleSubtask(s)} />
              <span className={s.is_done ? 'text-[var(--color-text-muted)] line-through' : ''}>{s.title}</span>
            </li>
          ))}
        </ul>
        {!allSubtasksDone && subtasks.length > 0 ? (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">All subtasks must be done before completing the task.</p>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Platforms</h2>
        <div className="space-y-6">
          {platforms.map((tp) => {
            const pt = tp.client_platforms?.platform
            if (!pt) return null
            const Icon = PLATFORM_ICON[pt]
            return (
              <div key={tp.id} className="rounded-lg border border-[var(--color-border)] p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <PlatformBadge label={PLATFORM_LABEL[pt]} icon={Icon} />
                  <StatusBadge status={tp.status} />
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Assignee</label>
                  {tp.assigned_user_id ? (
                    <p className="mb-1 text-xs text-[var(--color-text-muted)]">
                      Current: {profiles.find((p) => p.id === tp.assigned_user_id)?.full_name ?? tp.assigned_user_id}
                    </p>
                  ) : null}
                  <select
                    className="w-full max-w-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm sm:w-auto"
                    value={tp.assigned_user_id ?? ''}
                    onChange={(e) => void assignPlatform(tp.id, e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => void advancePlatform(tp)}>
                    Advance status
                  </Button>
                  {isElevated && tp.status === 'review' ? (
                    <Button type="button" onClick={() => void marketingApprove(tp)}>
                      Approve (Head)
                    </Button>
                  ) : null}
                  <Button type="button" variant="secondary" onClick={() => setRejectOpen(rejectOpen === tp.id ? null : tp.id)}>
                    Reject / send back
                  </Button>
                </div>
                {rejectOpen === tp.id ? (
                  <div className="mt-3 space-y-2">
                    <TextArea value={rejectText} onChange={(e) => setRejectText(e.target.value)} placeholder="Feedback" />
                    <Button type="button" variant="danger" onClick={() => void rejectPlatform(tp)}>
                      Confirm rejection
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })}
          {!platforms.length ? <p className="text-sm text-[var(--color-text-muted)]">No platforms on this task.</p> : null}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void completeTask()}>
          Mark task completed
        </Button>
        <span className="self-center text-xs text-[var(--color-text-muted)]">Signed in as {profile?.full_name}</span>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Comments</h2>
        <div className="mb-3 space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="rounded-md border border-[var(--color-border)] p-2 text-sm">
              <p className="text-[var(--color-text)]">{c.body}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {(c as Comment & { profiles?: { full_name?: string } }).profiles?.full_name ?? 'User'} ·{' '}
                {format(new Date(c.created_at), 'PPp')}
                {c.is_rejection ? <span className="text-red-500"> · Rejection</span> : null}
              </p>
            </div>
          ))}
        </div>
        <TextArea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Add a comment" />
        <Button className="mt-2" type="button" onClick={() => void postComment()}>
          Post
        </Button>
      </Card>
    </div>
  )
}
