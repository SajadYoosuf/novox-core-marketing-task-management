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
import type {
  TaskWithRelations,
  Profile,
  Subtask,
} from '@/types/db'
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
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState('')
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([])
  const [platformMenuOpen, setPlatformMenuOpen] = useState(false)
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

      const [subtaskRes, assigneeRes, platformRes, clientPlatRes, profileRes] = await Promise.all([
        supabase.from('subtasks').select('*').eq('task_id', tid).order('sort_order'),
        supabase.from('task_assignees').select('*').eq('task_id', tid),
        supabase.from('task_platforms').select('*').eq('task_id', tid),
        supabase.from('client_platforms').select('*').eq('client_id', taskData.client_id),
        supabase.from('profiles').select('*').order('full_name'),
      ])

      const cpMap = new Map((clientPlatRes.data ?? []).map(cp => [cp.id, cp]))
      const profMap = new Map((profileRes.data ?? []).map(p => [p.id, p]))
      setPlatforms(clientPlatRes.data ?? [])

      const enrichedPlatforms = (platformRes.data ?? []).map(tp => ({
        ...tp,
        client_platforms: cpMap.get(tp.client_platform_id) ?? null,
      }))

      const enrichedAssignees = (assigneeRes.data ?? []).map(ta => ({
        ...ta,
        profiles: profMap.get(ta.user_id) ?? null,
      }))

      const tSubtasks = (subtaskRes.data ?? []).map(st => ({
        ...st,
        profiles: profMap.get(st.assigned_user_id) ?? null,
      }))

      const tPlatforms = (platformRes.data ?? []).map(tp => {
        const cp = cpMap.get(tp.client_platform_id)
        return {
          id: tp.id,
          task_id: tid,
          title: `Post on ${PLATFORM_LABEL[cp?.platform as keyof typeof PLATFORM_LABEL] || 'Platform'}`,
          is_done: tp.status === 'posted' || tp.status === 'completed',
          assigned_user_id: tp.assigned_user_id,
          profiles: profMap.get(tp.assigned_user_id) ?? null,
          is_platform: true,
          client_platform_id: tp.client_platform_id
        }
      })

      const assembled: TaskWithRelations = {
        ...taskData,
        subtasks: [...tSubtasks, ...tPlatforms] as any,
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
        sort_order: (task?.subtasks?.length || 0) + 1
      })
    } else {
      // Create multiple platform assignments
      const platformRows = selectedPlatformIds.map(pid => ({
        task_id: taskId,
        client_platform_id: pid,
        assigned_user_id: newSubtaskAssignee || null,
        status: 'pending' as any
      }))
      await supabase.from('task_platforms').insert(platformRows)
      
      // Also optionally create one subtask entry as a "parent" title
      await supabase.from('subtasks').insert({
        task_id: taskId,
        title: newSubtaskTitle.trim(),
        assigned_user_id: newSubtaskAssignee || null,
        is_done: false,
        sort_order: (task?.subtasks?.length || 0) + 1
      })
    }

    setNewSubtaskTitle('')
    setNewSubtaskAssignee('')
    setSelectedPlatformIds([])
    void loadTask(taskId)
    onUpdate()
  }

  const updateSubtask = async (stId: string, updates: Partial<Subtask>) => {
    if (!supabaseConfigured) return
    await supabase.from('subtasks').update(updates).eq('id', stId)
    if (taskId) void loadTask(taskId)
    onUpdate()
  }

  const deleteSubtask = async (stId: string) => {
    if (!supabaseConfigured || !confirm('Delete this subtask?')) return
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
    
    // Save any subtask title changes if we added an 'editingSubtasks' state, 
    // but for now we'll handle subtasks as individual operations to keep it robust.
    
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
                    const assigneeId = st.assigned_user_id
                    const assignee = assigneeId ? profiles.find(p => p.id === assigneeId) : null
                    const platform = (st as any).client_platform_id
                      ? (task.task_platforms?.find(tp => tp.client_platform_id === (st as any).client_platform_id)?.client_platforms as any)?.platform
                      : null
                    const PlatIcon = platform ? (PLATFORM_ICON[platform] || Globe) : null
                    const isPlatformType = (st as any).is_platform

                    return (
                      <div key={st.id} className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden transition-all">
                        {/* Subtask Row */}
                        <div className="flex items-center gap-3 p-3">
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleSubtask(st)}
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
                          
                          {/* Title + Editor */}
                          <div className="flex-1 min-w-0 py-1">
                            {editing && !isPlatformType ? (
                              <input
                                className="w-full bg-transparent text-sm font-bold text-white focus:outline-none"
                                value={st.title}
                                onChange={(e) => void updateSubtask(st.id, { title: e.target.value })}
                              />
                            ) : (
                              <div 
                                className="flex items-center gap-2 cursor-pointer"
                                onClick={() => setExpandedSubtask(isExpanded ? null : st.id)}
                              >
                                <span className={`text-sm font-bold block truncate ${st.is_done ? 'text-[#4F5B76] line-through' : 'text-white/80'}`}>
                                  {st.title}
                                </span>
                                {isPlatformType && (
                                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/5 
                                    ${(st as any).platform_status === 'posted' ? 'text-emerald-400 border-emerald-400/20' : 'text-indigo-400'}
                                  `}>
                                    {(st as any).platform_status || 'PENDING'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Controls / Member Select */}
                          <div className="flex items-center gap-2 shrink-0">
                            {editing && !isPlatformType ? (
                              <div className="flex flex-col gap-1 items-end">
                                <div className="flex items-center gap-2">
                                  <select
                                    className="bg-transparent text-[10px] font-bold text-[#4F5B76] focus:outline-none"
                                    value={st.assigned_user_id || ''}
                                    onChange={(e) => void updateSubtask(st.id, { assigned_user_id: e.target.value || null })}
                                  >
                                    <option value="">No Assignee</option>
                                    {profiles.map(p => (
                                      <option key={p.id} value={p.id}>{p.full_name}</option>
                                    ))}
                                  </select>
                                  {(profiles.find(p => p.id === st.assigned_user_id)?.role !== 'designer') && (
                                    <select
                                      className="bg-transparent text-[9px] font-black uppercase text-[#EE4667] focus:outline-none border-l border-white/5 pl-2"
                                      value={st.client_platform_id || ''}
                                      onChange={(e) => void updateSubtask(st.id, { client_platform_id: e.target.value || null })}
                                    >
                                      <option value="">No Platform</option>
                                      {platforms.map(p => (
                                        <option key={p.id} value={p.id}>{PLATFORM_LABEL[p.platform as keyof typeof PLATFORM_LABEL] || p.platform}</option>
                                      ))}
                                    </select>
                                  )}
                                  <button 
                                    onClick={() => void deleteSubtask(st.id)}
                                    className="p-1 text-rose-500 hover:bg-rose-500/10 rounded transition-all"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {assignee && (
                                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center text-[9px] font-black text-indigo-400">
                                    {assignee.full_name.charAt(0)}
                                  </div>
                                )}
                                {PlatIcon && (
                                  <div className="h-6 w-6 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
                                    <PlatIcon className="h-3.5 w-3.5 text-[#4F5B76]" />
                                  </div>
                                )}
                                <ChevronDown 
                                  onClick={() => setExpandedSubtask(isExpanded ? null : st.id)}
                                  className={`h-3.5 w-3.5 text-[#4F5B76] transition-transform cursor-pointer ${isExpanded ? 'rotate-180' : ''}`} 
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && !editing && (
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
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Add Subtask Entry */}
                  {editing && (
                    <div className="flex flex-col gap-2 p-3 rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 flex items-center justify-center text-[#4F5B76]">
                          <CheckSquare className="h-3.5 w-3.5" />
                        </div>
                        <input
                          className="flex-1 bg-transparent text-sm font-bold text-white/40 focus:text-white focus:outline-none placeholder:text-[#4F5B76]"
                          placeholder="Add subtask..."
                          value={newSubtaskTitle}
                          onChange={(e) => setNewSubtaskTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                        />
                        {newSubtaskTitle.trim() && (
                          <button 
                            onClick={addSubtask}
                            className="px-2 py-1 bg-[var(--color-accent)] text-[9px] font-black uppercase tracking-widest text-white rounded-md"
                          >
                            Add
                          </button>
                        )}
                      </div>
                      <div className="ml-8 flex items-center gap-4">
                        <select
                          className="bg-transparent text-[10px] font-bold text-[#4F5B76] focus:outline-none cursor-pointer hover:text-[var(--color-accent)]"
                          value={newSubtaskAssignee}
                          onChange={(e) => setNewSubtaskAssignee(e.target.value)}
                        >
                          <option value="">Assign Member</option>
                          {profiles.map(p => (
                            <option key={p.id} value={p.id}>{p.full_name}</option>
                          ))}
                        </select>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setPlatformMenuOpen(!platformMenuOpen)}
                            disabled={profiles.find(p => p.id === newSubtaskAssignee)?.role === 'designer'}
                            className={`h-8 min-w-[120px] rounded-lg bg-black/40 border border-white/5 px-3 text-[9px] font-black uppercase text-white/50 hover:text-white transition-all flex items-center justify-between gap-2 cursor-pointer 
                              ${(profiles.find(p => p.id === newSubtaskAssignee)?.role?.includes('designer')) ? 'opacity-30 grayscale cursor-not-allowed' : ''}
                            `}
                          >
                            <span>
                              {selectedPlatformIds.length === 0 ? 'Select Platforms' : `${selectedPlatformIds.length} Platforms`}
                            </span>
                            <ChevronDown className="h-3 w-3" />
                          </button>
                          
                          {platformMenuOpen && (
                            <div className="absolute bottom-full right-0 mb-2 z-[150] w-48 overflow-hidden rounded-xl border border-white/10 bg-[#161B26] p-1 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                              {platforms.map(p => {
                                const isSelected = selectedPlatformIds.includes(p.id)
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setSelectedPlatformIds(prev => 
                                      prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                    )}
                                    className={`flex w-full items-center justify-between px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer text-left
                                      ${isSelected ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
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
                  )}
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
