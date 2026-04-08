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
  LayoutGrid,
  Plus
} from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, TextArea } from '@/components/ui/Input'
import type {
  TaskWithRelations,
  Profile,
} from '@/types/db'
import { format, parseISO } from 'date-fns'
import { STATUS_LABEL, PLATFORM_ICON, PLATFORM_LABEL } from '@/lib/constants'
import { KANBAN_COLUMNS } from '@/lib/taskWorkflow'
import { CustomDropdown } from '@/components/ui/CustomDropdown'

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
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState('')
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([])
  const [platforms, setPlatforms] = useState<any[]>([])

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

      const [subtaskRes, assigneeRes, clientPlatRes, profileRes] = await Promise.all([
        supabase.from('subtasks').select('*, client_platforms(platform)').eq('task_id', tid).order('sort_order'),
        supabase.from('task_assignees').select('*').eq('task_id', tid),
        supabase.from('client_platforms').select('*').eq('client_id', taskData.client_id),
        supabase.from('profiles').select('*').order('full_name'),
      ])

      const profMap = new Map((profileRes.data ?? []).map(p => [p.id, p]))
      setPlatforms(clientPlatRes.data ?? [])

      const enrichedAssignees = (assigneeRes.data ?? []).map(ta => ({
        ...ta,
        profiles: profMap.get(ta.user_id) ?? null,
      }))

      const tSubtasks = (subtaskRes.data ?? []).map(st => ({
        ...st,
        profiles: profMap.get(st.assigned_user_id) ?? null,
      }))

      const assembled: TaskWithRelations = {
        ...taskData,
        subtasks: tSubtasks as any,
        task_assignees: enrichedAssignees,
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

  const toggleSubtask = async (st: any) => {
    if (!supabaseConfigured || !task) return

    const newIsDone = !st.is_done
    const newStatus = newIsDone ? 'completed' : 'pending'

    // Optimistic Update helper
    const updater = <T extends Partial<TaskWithRelations> | null>(t: T): T => {
      if (!t) return t
      return {
        ...t,
        subtasks: (t.subtasks || []).map((s: any) => s.id === st.id ? { ...s, is_done: newIsDone, status: newStatus } : s)
      }
    }
    setTask(prev => updater(prev) as TaskWithRelations | null)
    setDraft(prev => updater(prev) as Partial<TaskWithRelations>)

    await supabase.from('subtasks').update({ is_done: newIsDone, status: newStatus }).eq('id', st.id)

    // Refetch to confirm
    if (taskId) void loadTask(taskId)
    onUpdate()
  }

  const updateStatus = async (status: string) => {
    if (!supabaseConfigured || !taskId) return
    const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId)
    if (error) {
      console.error('Status update failed:', error)
      alert(`Failed to update status: ${error.message}`)
      return
    }
    void loadTask(taskId)
    onUpdate()
  }

  const addSubtask = async () => {
    if (!supabaseConfigured || !taskId || !newSubtaskTitle.trim()) return

    const assignee = profiles.find(p => p.id === newSubtaskAssignee)
    const isDesigner = assignee?.role === 'designer' || assignee?.role === 'designer_head'

    if (isDesigner || selectedPlatformIds.length === 0) {
      await supabase.from('subtasks').insert({
        task_id: taskId,
        title: newSubtaskTitle.trim(),
        assigned_user_id: newSubtaskAssignee || null,
        is_done: false,
        status: 'pending',
        sort_order: (task?.subtasks?.length || 0) + 1
      })
    } else {
      // Create separate platform posting subtasks
      const subtasks = selectedPlatformIds.map((pid, idx) => {
        const plat = platforms.find(p => p.id === pid)
        return {
          task_id: taskId,
          title: `Post to ${PLATFORM_LABEL[plat?.platform as keyof typeof PLATFORM_LABEL] || 'Platform'}`,
          client_platform_id: pid,
          platform_type: plat?.platform || null,
          assigned_user_id: newSubtaskAssignee || null,
          status: 'pending',
          is_done: false,
          sort_order: (task?.subtasks?.length || 0) + 1 + idx
        }
      })
      await supabase.from('subtasks').insert(subtasks)
    }

    setNewSubtaskTitle('')
    setNewSubtaskAssignee('')
    setSelectedPlatformIds([])
    void loadTask(taskId)
    onUpdate()
  }

  const deleteSubtask = async (stId: string) => {
    if (!supabaseConfigured || !confirm('Delete this item?')) return
    await supabase.from('subtasks').delete().eq('id', stId)
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
        className={`fixed right-0 top-0 z-[110] h-full w-full sm:max-w-[560px] border-l border-white/5 bg-[#0B0D13] shadow-2xl transition-transform duration-500 ease-out ${taskId ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {loading && !task ? (
          <div className="flex h-full flex-col items-center justify-center space-y-4">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--color-accent)] border-t-transparent" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4F5B76]">Loading Marketing Data...</p>
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center p-12 text-center space-y-6">
            <AlertTriangle className="h-10 w-10 text-rose-500" />
            <div>
              <h3 className="text-lg font-bold text-white">Project Connection Lost</h3>
              <p className="mt-2 text-sm text-[#4F5B76]">{error}</p>
            </div>
            <Button onClick={onClose} className="h-10 px-6 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-[#4F5B76]">
              Close Panel
            </Button>
          </div>
        ) : task ? (
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="relative p-6 pb-5 border-b border-white/5">
              <div className="absolute right-6 top-6 flex items-center gap-2">
                {task && (
                  <CustomDropdown
                    options={KANBAN_COLUMNS.map(s => ({ id: s, name: STATUS_LABEL[s] }))}
                    value={task.status}
                    onChange={updateStatus}
                    placeholder="Workflow Status"
                    className="min-w-[150px] h-9"
                    icon={<LayoutGrid className="h-3.5 w-3.5" />}
                  />
                )}
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
                  {task.clients?.name || 'Unassigned Client'}
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
                      {task.deadline ? format(parseISO(task.deadline), 'MMM d, yyyy') : 'No Target Date'}
                    </span>
                  )}
                </div>
                <div className={`rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider border ${task.priority === 'high' || task.priority === 'urgent' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                    task.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                  {task.priority} Priority
                </div>
              </div>

              {/* Description */}
              {(editing || task.description) && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#4F5B76]">Strategy & Description</span>
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

              {/* Subtasks (Unified) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-[var(--color-accent)]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#4F5B76]">Units of Work</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#4F5B76]">
                    {completedSubtasks}/{totalSubtasks} Completed
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
                    const assigneeId = st.assigned_user_id
                    const assignee = assigneeId ? profiles.find(p => p.id === assigneeId) : null
                    const platform = st.platform_type
                    const PlatIcon = platform ? (PLATFORM_ICON[platform] || Globe) : null

                    return (
                      <div key={st.id} className={`rounded-xl border transition-all overflow-hidden ${st.is_done ? 'border-emerald-500/10 bg-emerald-500/[0.02]' : 'border-white/5 bg-white/[0.02]'}`}>
                        <div className="flex items-center gap-3 p-3">
                          <button
                            onClick={() => toggleSubtask(st)}
                            className="shrink-0 cursor-pointer"
                          >
                            {st.is_done ? (
                              <div className="h-5 w-5 rounded-md bg-emerald-500 flex items-center justify-center text-white">
                                <CheckCircle2 className="h-3 w-3" />
                              </div>
                            ) : (
                              <div className="h-5 w-5 rounded-md border-2 border-white/10 hover:border-indigo-500 transition-colors" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0" onClick={() => setExpandedSubtask(isExpanded ? null : st.id)}>
                            <div className="flex items-center gap-2 cursor-pointer">
                              {PlatIcon && <PlatIcon className={`h-3 w-3 ${st.is_done ? 'text-emerald-500' : 'text-indigo-400'}`} />}
                              <span className={`text-sm font-bold block truncate ${st.is_done ? 'text-emerald-500/40 line-through' : 'text-white/80'}`}>
                                {st.title}
                              </span>
                              {platform && (
                                <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${st.is_done ? 'bg-emerald-500/10 text-emerald-500' : 'bg-white/5 text-[#4F5B76]'}`}>
                                  {platform}
                                </span>
                              )}
                            </div>
                            {assignee && (
                              <p className="text-[9px] font-bold text-[#4F5B76] uppercase tracking-tighter mt-0.5">
                                {assignee.full_name} · {assignee.role?.replace('_', ' ')}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {editing && (
                              <button
                                onClick={() => void deleteSubtask(st.id)}
                                className="p-1 text-rose-500 hover:bg-rose-500/10 rounded transition-all"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                            <ChevronDown className={`h-3 w-3 text-[#4F5B76] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {editing && (
                    <div className="flex flex-col gap-2 p-3 rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
                      {/* Similar simplified add subtask flow */}
                      <div className="flex items-center gap-3">
                        <Plus className="h-3.5 w-3.5 text-[#4F5B76]" />
                        <input
                          className="flex-1 bg-transparent text-sm font-bold text-white/40 focus:text-white focus:outline-none placeholder:text-[#4F5B76]"
                          placeholder="Inject more work..."
                          value={newSubtaskTitle}
                          onChange={(e) => setNewSubtaskTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                        />
                      </div>
                      <div className="ml-7 flex items-center gap-4">
                        <select
                          className="bg-transparent text-[10px] font-bold text-[#4F5B76] focus:outline-none"
                          value={newSubtaskAssignee}
                          onChange={(e) => setNewSubtaskAssignee(e.target.value)}
                        >
                          <option value="">Assign To</option>
                          {profiles.map(p => (
                            <option key={p.id} value={p.id}>{p.full_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5">
              {editing ? (
                <Button
                  onClick={save}
                  className="h-12 w-full rounded-xl bg-emerald-500 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-emerald-500/10"
                >
                  Save Global State
                </Button>
              ) : (
                <Button
                  onClick={onClose}
                  className="h-12 w-full rounded-xl bg-indigo-600 text-xs font-bold uppercase tracking-widest text-white"
                >
                  Exit Task View
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
