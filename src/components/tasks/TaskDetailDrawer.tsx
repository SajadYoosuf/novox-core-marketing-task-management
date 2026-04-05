import { useEffect, useState, useCallback } from 'react'
import {
  X,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Edit2,
  AlertTriangle,
  Globe,
  ChevronDown,
  User
} from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, TextArea } from '@/components/ui/Input'
import type { TaskWithRelations, Subtask, Profile } from '@/types/db'
import { format, parseISO } from 'date-fns'
import { PLATFORM_ICON, PLATFORM_LABEL } from '@/lib/constants'

interface TaskDetailDrawerProps {
  taskId: string | null
  onClose: () => void
  onUpdate: () => void
}

export function TaskDetailDrawer({ taskId, onClose, onUpdate }: TaskDetailDrawerProps) {
  const [task, setTask] = useState<TaskWithRelations | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<TaskWithRelations>>({})
  const [expandedSubtask, setExpandedSubtask] = useState<string | null>(null)

  const loadTask = useCallback(async (tid: string) => {
    if (!supabaseConfigured) return
    setLoading(true)
    setError(null)

    try {
      const { data: taskData, error: tErr } = await supabase
        .from('tasks')
        .select('*, clients(*)')
        .eq('id', tid)
        .maybeSingle()

      if (tErr) throw tErr
      if (!taskData) throw new Error('Task not found.')

      const [subtaskRes, assigneeRes, platformRes, clientPlatRes, profileRes] = await Promise.all([
        supabase.from('subtasks').select('*').eq('task_id', tid).order('sort_order'),
        supabase.from('task_assignees').select('*').eq('task_id', tid),
        supabase.from('task_platforms').select('*').eq('task_id', tid),
        supabase.from('client_platforms').select('*'),
        supabase.from('profiles').select('*').order('full_name'),
      ])

      const cpMap = new Map((clientPlatRes.data ?? []).map(cp => [cp.id, cp]))
      const profMap = new Map((profileRes.data ?? []).map(p => [p.id, p]))

      const enrichedPlatforms = (platformRes.data ?? []).map(tp => ({
        ...tp,
        client_platforms: cpMap.get(tp.client_platform_id) ?? null,
      }))

      const enrichedAssignees = (assigneeRes.data ?? []).map(ta => ({
        ...ta,
        profiles: profMap.get(ta.user_id) ?? null,
      }))

      const assembled: TaskWithRelations = {
        ...taskData,
        subtasks: (subtaskRes.data ?? []) as Subtask[],
        task_assignees: enrichedAssignees,
        task_platforms: enrichedPlatforms,
      }

      setTask(assembled)
      setDraft(assembled)
      setProfiles((profileRes.data as Profile[]) ?? [])
    } catch (err: any) {
      console.error('Detail load failed:', err)
      setError(err.message || 'Failed to load task details.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (taskId) {
      void loadTask(taskId)
      setExpandedSubtask(null)
    } else {
      setTask(null)
      setError(null)
      setEditing(false)
      setExpandedSubtask(null)
    }
  }, [taskId, loadTask])

  const toggleSubtask = async (st: Subtask) => {
    if (!supabaseConfigured) return
    await supabase.from('subtasks').update({ is_done: !st.is_done }).eq('id', st.id)
    if (taskId) void loadTask(taskId)
    onUpdate()
  }

  const save = async () => {
    if (!supabaseConfigured || !taskId || !draft) return
    await supabase.from('tasks').update({
      title: draft.title,
      description: draft.description,
      priority: draft.priority,
      status: draft.status,
      deadline: draft.deadline,
    }).eq('id', taskId)
    setEditing(false)
    if (taskId) void loadTask(taskId)
    onUpdate()
  }

  const totalSubtasks = task?.subtasks?.length || 0
  const completedSubtasks = task?.subtasks?.filter(s => s.is_done).length || 0

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[100] bg-[#02040A]/60 backdrop-blur-sm transition-all duration-500 ${taskId ? 'opacity-100 pointer-events-auto' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-[110] h-full w-full max-w-[560px] border-l border-white/5 bg-[#0B0D13] shadow-2xl transition-transform duration-500 ease-out ${taskId ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {loading && !task ? (
          <div className="flex h-full flex-col items-center justify-center space-y-4">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--color-accent)] border-t-transparent" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4F5B76]">Loading...</p>
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center p-12 text-center space-y-6">
            <AlertTriangle className="h-10 w-10 text-rose-500" />
            <div>
              <h3 className="text-lg font-bold text-white">Something went wrong</h3>
              <p className="mt-2 text-sm text-[#4F5B76]">{error}</p>
            </div>
            <Button onClick={onClose} className="h-10 px-6 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-[#4F5B76]">
              Close
            </Button>
          </div>
        ) : task ? (
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="relative p-6 pb-5 border-b border-white/5">
              <div className="absolute right-6 top-6 flex items-center gap-2">
                <button
                  onClick={() => setEditing(!editing)}
                  className={`h-9 w-9 flex items-center justify-center rounded-lg border border-white/5 transition-all cursor-pointer ${editing ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'bg-white/5 text-[#4F5B76] hover:text-white'}`}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={onClose}
                  className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer text-[#4F5B76] hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Client & Content Type */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-accent)]">
                  {task.clients?.name || 'No Client'}
                </span>
                <span className="text-[#4F5B76]">·</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#4F5B76]">
                  {task.content_type?.replace('_', ' ') || 'Task'}
                </span>
              </div>

              {/* Title */}
              {editing ? (
                <Input
                  value={draft.title || ''}
                  onChange={e => setDraft({ ...draft, title: e.target.value })}
                  className="bg-black/40 border-white/10 text-xl font-bold"
                />
              ) : (
                <h2 className="text-2xl font-bold text-white leading-tight pr-24">{task.title}</h2>
              )}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-6">

              {/* Info Row: Deadline + Priority */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2">
                  <Calendar className="h-3.5 w-3.5 text-[#EE4667]" />
                  {editing ? (
                    <Input
                      type="datetime-local"
                      value={draft.deadline?.slice(0, 16) || ''}
                      onChange={e => setDraft({ ...draft, deadline: e.target.value })}
                      className="bg-transparent h-6 border-0 text-xs text-white/70 p-0"
                    />
                  ) : (
                    <span className="text-xs font-bold text-white/80">
                      {task.deadline ? format(parseISO(task.deadline), 'MMM d, yyyy') : 'No deadline'}
                    </span>
                  )}
                </div>
                <div className={`rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider border ${
                  task.priority === 'high' || task.priority === 'urgent' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                  task.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {task.priority}
                </div>
                <div className={`rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider border bg-white/[0.03] border-white/5 text-white/60`}>
                  {task.status.replace('_', ' ')}
                </div>
              </div>

              {/* Description */}
              {(editing || task.description) && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#4F5B76]">Description</span>
                  {editing ? (
                    <TextArea
                      value={draft.description || ''}
                      onChange={e => setDraft({ ...draft, description: e.target.value })}
                      className="bg-black/40 border-white/10 text-sm h-28"
                    />
                  ) : (
                    <p className="text-sm leading-relaxed text-white/60">{task.description}</p>
                  )}
                </div>
              )}

              {/* Platforms */}
              {task.task_platforms && task.task_platforms.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#4F5B76]">Platforms</span>
                  <div className="flex flex-wrap gap-2">
                    {task.task_platforms.map(tp => {
                      const platform = (tp.client_platforms as any)?.platform || 'unknown'
                      const Icon = PLATFORM_ICON[platform] || Globe
                      return (
                        <div key={tp.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/5 px-3 py-1.5">
                          <Icon className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                            {PLATFORM_LABEL[platform] || platform}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Team Members — from task_assignees + subtask assignees */}
              {(() => {
                // Collect all unique assignees from both sources
                const memberMap = new Map<string, Profile>()
                // From task_assignees
                task.task_assignees?.forEach(ta => {
                  const prof = (ta as any).profiles as Profile | null
                  if (prof) memberMap.set(ta.user_id, prof)
                })
                // From subtask assigned_user_id
                task.subtasks?.forEach(st => {
                  if (st.assigned_user_id && !memberMap.has(st.assigned_user_id)) {
                    const prof = profiles.find(p => p.id === st.assigned_user_id)
                    if (prof) memberMap.set(st.assigned_user_id, prof)
                  }
                })
                const members = Array.from(memberMap.values())
                if (members.length === 0) return null
                return (
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#4F5B76]">Team Members</span>
                    <div className="flex flex-wrap gap-2">
                      {members.map(prof => (
                        <div key={prof.id} className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[9px] font-bold text-white">
                            {prof.full_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white/90">{prof.full_name || 'Unknown'}</p>
                            <p className="text-[9px] text-[#4F5B76]">{prof.role?.replace('_', ' ') || 'Member'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Subtasks */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-[var(--color-accent)]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#4F5B76]">Subtasks</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#4F5B76]">
                    {completedSubtasks}/{totalSubtasks}
                  </span>
                </div>

                {totalSubtasks > 0 && (
                  <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                      style={{ width: `${totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0}%` }}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  {task.subtasks?.map(st => {
                    const isExpanded = expandedSubtask === st.id
                    const assignee = st.assigned_user_id ? profiles.find(p => p.id === st.assigned_user_id) : null
                    const platform = st.client_platform_id
                      ? (task.task_platforms?.find(tp => tp.client_platform_id === st.client_platform_id)?.client_platforms as any)?.platform
                      : null
                    const PlatIcon = platform ? (PLATFORM_ICON[platform] || Globe) : null

                    return (
                      <div key={st.id} className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden transition-all">
                        {/* Subtask Row */}
                        <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/[0.03] transition-colors">
                          {/* Checkbox */}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleSubtask(st) }}
                            className="shrink-0 cursor-pointer"
                          >
                            {st.is_done ? (
                              <div className="h-5 w-5 rounded-md bg-[var(--color-accent)] flex items-center justify-center text-white">
                                <CheckCircle2 className="h-3 w-3" />
                              </div>
                            ) : (
                              <div className="h-5 w-5 rounded-md border-2 border-white/10 hover:border-[var(--color-accent)]/40 transition-colors" />
                            )}
                          </button>

                          {/* Title + quick info */}
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => setExpandedSubtask(isExpanded ? null : st.id)}
                          >
                            <span className={`text-sm font-medium block truncate ${st.is_done ? 'text-[#4F5B76] line-through' : 'text-white/80'}`}>
                              {st.title}
                            </span>
                          </div>

                          {/* Quick indicators */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {assignee && (
                              <div className="h-5 w-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[8px] font-bold text-indigo-400">
                                {assignee.full_name.charAt(0)}
                              </div>
                            )}
                            {PlatIcon && <PlatIcon className="h-3.5 w-3.5 text-[#4F5B76]" />}
                            <button
                              onClick={() => setExpandedSubtask(isExpanded ? null : st.id)}
                              className="cursor-pointer"
                            >
                              <ChevronDown className={`h-3.5 w-3.5 text-[#4F5B76] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-0 border-t border-white/5 space-y-2">
                            {assignee && (
                              <div className="flex items-center gap-2 mt-2">
                                <User className="h-3 w-3 text-[#4F5B76]" />
                                <span className="text-xs text-white/70">{assignee.full_name}</span>
                                <span className="text-[9px] text-[#4F5B76]">({assignee.role?.replace('_', ' ')})</span>
                              </div>
                            )}
                            {platform && (
                              <div className="flex items-center gap-2">
                                {PlatIcon && <PlatIcon className="h-3 w-3 text-[#4F5B76]" />}
                                <span className="text-xs text-white/70">{PLATFORM_LABEL[platform] || platform}</span>
                              </div>
                            )}
                            {!assignee && !platform && (
                              <p className="text-xs text-[#4F5B76] italic mt-2">No additional details.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5">
              {editing ? (
                <Button
                  onClick={save}
                  className="h-12 w-full rounded-xl bg-emerald-500 text-xs font-bold uppercase tracking-widest text-white hover:bg-emerald-600 transition-colors"
                >
                  Save Changes
                </Button>
              ) : (
                <Button
                  onClick={onClose}
                  className="h-12 w-full rounded-xl bg-[var(--color-accent)] text-xs font-bold uppercase tracking-widest text-white hover:opacity-90 transition-opacity"
                >
                  Close
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
