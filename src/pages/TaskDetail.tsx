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
  TaskWithRelations,
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
  const [taskPlatforms, setTaskPlatforms] = useState<TaskPlatformRow[]>([])
  const [clientPlatforms, setClientPlatforms] = useState<any[]>([])

  const [comments, setComments] = useState<Comment[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [rejectOpen, setRejectOpen] = useState<string | null>(null)
  const [rejectText, setRejectText] = useState('')
  
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState('')
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([])
  const [platformMenuOpen, setPlatformMenuOpen] = useState(false)
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null)
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('')

  const load = useCallback(async () => {
    if (!supabaseConfigured || !id) return
    const { data: t } = await supabase.from('tasks').select('*, clients(name)').eq('id', id).maybeSingle()
    setTask(t as TaskRow)
    const { data: st } = await supabase.from('subtasks').select('*').eq('task_id', id).order('sort_order')
    setSubtasks((st as Subtask[]) ?? [])
    const { data: tp } = await supabase.from('task_platforms').select('*, client_platforms(platform)').eq('task_id', id)
    setTaskPlatforms((tp as TaskPlatformRow[]) ?? [])
    const { data: cm } = await supabase
      .from('comments')
      .select('*, profiles(full_name)')
      .eq('task_id', id)
      .order('created_at', { ascending: false })
    setComments((cm as Comment[]) ?? [])
    const { data: pr } = await supabase.from('profiles').select('*').order('full_name')
    setProfiles((pr as Profile[]) ?? [])
    if (t) {
      const { data: cPlats } = await supabase.from('client_platforms').select('*').eq('client_id', (t as TaskRow).client_id).eq('is_active', true)
      setClientPlatforms(cPlats ?? [])
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleSubtask(st: Subtask) {
    if (!supabaseConfigured) return
    await supabase.from('subtasks').update({ is_done: !st.is_done }).eq('id', st.id)
    await load()
  }

  async function addSubtask() {
    if (!supabaseConfigured || !id || !newSubtaskTitle.trim()) return

    const assignee = profiles.find(p => p.id === newSubtaskAssignee)
    const isDesigner = assignee?.role === 'designer' || assignee?.role === 'designer_head'

    if (isDesigner || selectedPlatformIds.length === 0) {
      await supabase.from('subtasks').insert({
        task_id: id,
        title: newSubtaskTitle.trim(),
        assigned_user_id: newSubtaskAssignee || null,
        sort_order: subtasks.length,
        is_done: false
      })
    } else {
      // Create multiple platform assignments
      const platformRows = selectedPlatformIds.map(pid => ({
        task_id: id,
        client_platform_id: pid,
        assigned_user_id: newSubtaskAssignee || null,
        status: 'pending' as any
      }))
      await supabase.from('task_platforms').insert(platformRows)
      
      // Also create parent subtask
      await supabase.from('subtasks').insert({
        task_id: id,
        title: newSubtaskTitle.trim(),
        assigned_user_id: newSubtaskAssignee || null,
        sort_order: subtasks.length,
        is_done: false
      })
    }

    setNewSubtaskTitle('')
    setNewSubtaskAssignee('')
    setSelectedPlatformIds([])
    await load()
  }

  async function updateSubtask(id: string, updates: Partial<Subtask>) {
    if (!supabaseConfigured) return
    await supabase.from('subtasks').update(updates).eq('id', id)
    await load()
  }

  async function deleteSubtask(id: string) {
    if (!supabaseConfigured) return
    if (!confirm('Are you sure you want to delete this subtask?')) return
    await supabase.from('subtasks').delete().eq('id', id)
    await load()
  }

  async function saveSubtaskEdit() {
    if (!editingSubtaskId) return
    await updateSubtask(editingSubtaskId, { title: editingSubtaskTitle.trim() })
    setEditingSubtaskId(null)
    setEditingSubtaskTitle('')
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
    const pending = taskPlatforms.filter((p: TaskPlatformRow) => p.status !== 'completed' && p.status !== 'approved')
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Subtasks</h2>
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
            {subtasks.filter(s => s.is_done).length} / {subtasks.length} DONE
          </span>
        </div>
        
        <div className="space-y-3">
          {subtasks.map((s) => (
            <div key={s.id} className="group relative flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/30 p-3 transition-all hover:border-[var(--color-accent)]/30">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                  checked={s.is_done}
                  onChange={() => void toggleSubtask(s)}
                />
                
                {editingSubtaskId === s.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      className="flex-1 bg-transparent text-sm font-medium focus:outline-none"
                      value={editingSubtaskTitle}
                      onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveSubtaskEdit()}
                      onBlur={() => saveSubtaskEdit()}
                    />
                  </div>
                ) : (
                  <span
                    className={`flex-1 text-sm font-medium transition-all ${s.is_done ? 'text-[var(--color-text-muted)] line-through opacity-50' : 'text-[var(--color-text)]'}`}
                    onClick={() => {
                      setEditingSubtaskId(s.id)
                      setEditingSubtaskTitle(s.title)
                    }}
                  >
                    {s.title}
                  </span>
                )}

                <button
                  onClick={() => void deleteSubtask(s.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-500/10 rounded transition-all"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>

              <div className="ml-7 flex items-center gap-4">
                <select
                  className="bg-transparent text-[11px] font-bold text-[var(--color-text-muted)] focus:outline-none cursor-pointer hover:text-[var(--color-accent)] transition-colors"
                  value={s.assigned_user_id || ''}
                  onChange={(e) => void updateSubtask(s.id, { assigned_user_id: e.target.value || null })}
                >
                  <option value="">Assign Member</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>

                {(profiles.find(p => p.id === s.assigned_user_id)?.role !== 'designer') && (
                  <select
                    className="bg-transparent text-[10px] font-black uppercase text-[#EE4667] focus:outline-none border-l border-white/5 pl-2"
                    value={s.client_platform_id || ''}
                    onChange={(e) => void updateSubtask(s.id, { client_platform_id: e.target.value || null })}
                  >
                    <option value="">No Platform</option>
                    {clientPlatforms.map((p) => (
                      <option key={p.id} value={p.id}>{PLATFORM_LABEL[p.platform as keyof typeof PLATFORM_LABEL] || p.platform}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}

          {/* New Subtask Row */}
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-dashed border-[var(--color-border)] p-3">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 flex items-center justify-center text-[var(--color-text-muted)]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </div>
              <input
                type="text"
                placeholder="Add new subtask..."
                className="flex-1 bg-transparent text-sm font-medium focus:outline-none placeholder:opacity-50"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
              />
              {newSubtaskTitle.trim() && (
                <button
                  onClick={() => void addSubtask()}
                  className="rounded bg-[var(--color-accent)] px-2 py-1 text-[10px] font-bold text-white transition-opacity hover:opacity-90"
                >
                  ADD
                </button>
              )}
            </div>
            
            <div className="ml-7 flex items-center gap-4">
              <select
                className="bg-transparent text-[11px] font-bold text-[var(--color-text-muted)] focus:outline-none cursor-pointer hover:text-[var(--color-accent)] transition-colors"
                value={newSubtaskAssignee}
                onChange={(e) => setNewSubtaskAssignee(e.target.value)}
              >
                <option value="">Assign Member</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPlatformMenuOpen(!platformMenuOpen)}
                  disabled={profiles.find(p => p.id === newSubtaskAssignee)?.role === 'designer'}
                  className={`flex items-center gap-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-1.5 text-[10px] font-black uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-all cursor-pointer 
                    ${(profiles.find(p => p.id === newSubtaskAssignee)?.role?.includes('designer')) ? 'opacity-30 grayscale cursor-not-allowed' : ''}
                  `}
                >
                  <span>
                    {selectedPlatformIds.length === 0 ? 'Select Platforms' : `${selectedPlatformIds.length} Chosen`}
                  </span>
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                
                {platformMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 z-[50] w-48 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-2xl animate-in fade-in slide-in-from-top-2">
                    {clientPlatforms.map(p => {
                      const isSelected = selectedPlatformIds.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPlatformIds(prev => 
                            prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                          )}
                          className={`flex w-full items-center justify-between px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer text-left
                            ${isSelected ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'}`}
                        >
                          <span>{PLATFORM_LABEL[p.platform as keyof typeof PLATFORM_LABEL] || p.platform}</span>
                          {isSelected && <div className="h-1 w-1 rounded-full bg-[var(--color-accent)]" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {!allSubtasksDone && subtasks.length > 0 ? (
          <p className="mt-4 text-xs font-semibold text-amber-500/80 uppercase tracking-widest">
            Complete all subtasks before completion
          </p>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Platforms</h2>
        <div className="space-y-6">
          {taskPlatforms.map((tp) => {
            const pt = (tp.client_platforms as any)?.platform
            if (!pt) return null
            const Icon = PLATFORM_ICON[pt as keyof typeof PLATFORM_ICON]
            return (
              <div key={tp.id} className="rounded-lg border border-[var(--color-border)] p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <PlatformBadge label={PLATFORM_LABEL[pt as keyof typeof PLATFORM_LABEL]} icon={Icon} />
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
          {!taskPlatforms.length ? <p className="text-sm text-[var(--color-text-muted)]">No platforms on this task.</p> : null}
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
