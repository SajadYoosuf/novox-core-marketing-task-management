import { useEffect, useState, useCallback, useRef } from 'react'
import {
  X,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Edit2,
  AlertTriangle
} from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, TextArea } from '@/components/ui/Input'
import type { TaskWithRelations, Subtask, Profile } from '@/types/db'
import { format, parseISO } from 'date-fns'

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
  const abortRef = useRef<boolean>(false)

  const loadTask = useCallback(async (tid: string) => {
    if (!supabaseConfigured) return
    setLoading(true)
    setError(null)
    
    try {
      console.log(`📡 Syncing Detail Unit: ${tid}...`)
      // Perform a more robust, sequential join if needed, but attempt a simplified single-fetch first
      const { data, error: tErr } = await supabase
        .from('tasks')
        .select('*, clients(*), task_assignees(*, profiles(*)), task_platforms(*, client_platforms(platform)), subtasks(*, client_platforms(platform))')
        .eq('id', tid)
        .maybeSingle()

      if (tErr) throw tErr
      if (!data) throw new Error('Marketing strategic unit not found in core.')

      setTask(data as TaskWithRelations)
      setDraft(data as TaskWithRelations)

      const { data: p } = await supabase.from('profiles').select('*').order('full_name')
      setProfiles((p as Profile[]) ?? [])
    } catch (err: any) {
      console.error('❌ Strategic Retrieval Failed:', err)
      setError(err.message || 'Operation synchronization failure.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (taskId) {
       void loadTask(taskId)
    } else {
       setTask(null)
       setError(null)
       setEditing(false)
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

      {/* Drawer Container */}
      <div
        className={`fixed right-0 top-0 z-[110] h-full w-full max-w-[580px] border-l border-white/5 bg-[#0B0D13] shadow-2xl transition-transform duration-500 ease-out ${taskId ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {loading && !task ? (
          <div className="flex h-full flex-col items-center justify-center space-y-4">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--color-accent)] border-t-transparent shadow-xl" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4F5B76]">Compiling Brief...</p>
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center p-12 text-center space-y-6">
             <div className="h-20 w-20 rounded-[2rem] bg-rose-500/10 flex items-center justify-center">
                <AlertTriangle className="h-10 w-10 text-rose-500" />
             </div>
             <div>
                <h3 className="text-xl font-black text-white tracking-tight">Sync Disrupted</h3>
                <p className="mt-2 text-sm text-[var(--color-text-muted)] font-medium leading-relaxed opacity-60">
                   {error}
                </p>
             </div>
             <Button onClick={onClose} className="h-12 px-8 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest text-[#4F5B76] hover:text-white">
                Back to Canvas
             </Button>
          </div>
        ) : task ? (
          <div className="flex h-full flex-col">
            {/* Header Infrastructure */}
            <div className="relative p-8 pb-12 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
              <div className="absolute right-8 top-8 flex items-center gap-3">
                <button 
                  onClick={() => setEditing(!editing)}
                  className={`h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 transition-all cursor-pointer ${editing ? 'text-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20' : 'text-[#4F5B76] hover:text-white'}`}
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={onClose}
                  className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="inline-flex items-center gap-2">
                  <span className="rounded-lg bg-[var(--color-accent)]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--color-accent)] border border-[var(--color-accent)]/10">
                    {task.content_type?.replace('_', ' ') || 'TACTICAL UNIT'}
                  </span>
                  <div className={`h-2 w-2 rounded-full ${task.priority === 'high' ? 'bg-rose-500 shadow-[0_0_8px_rose-500]' : 'bg-blue-500'}`} />
                </div>
                
                {editing ? (
                  <Input 
                    value={draft.title || ''} 
                    onChange={e => setDraft({...draft, title: e.target.value})} 
                    className="bg-black/40 border-white/10 text-2xl font-black focus:border-indigo-500 mt-2"
                  />
                ) : (
                  <h2 className="mt-2 text-3xl font-black text-white tracking-tight leading-tight">{task.title}</h2>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-8 space-y-10">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4F5B76]">Strategic Milestone</span>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-[#EE4667]" />
                    {editing ? (
                      <Input 
                        type="datetime-local" 
                        value={draft.deadline?.slice(0, 16) || ''} 
                        onChange={e => setDraft({...draft, deadline: e.target.value})} 
                        className="bg-black/40 h-8 border-white/5 text-xs text-white/70"
                      />
                    ) : (
                      <span className="text-sm font-bold text-white/90">
                        {task.deadline ? format(parseISO(task.deadline), 'MMM d, yyyy') : 'Indefinite Execution'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-right">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4F5B76]">Direct Brand</span>
                  <p className="text-sm font-bold text-white/90 truncate">{task.clients?.name || 'Internal Pipeline'}</p>
                </div>
              </div>

              {/* Strategic Brief */}
              <div className="space-y-3 p-6 rounded-3xl bg-white/[0.02] border border-white/5">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4F5B76]">Marketing Brief</span>
                {editing ? (
                   <TextArea 
                     value={draft.description || ''} 
                     onChange={e => setDraft({...draft, description: e.target.value})} 
                     className="bg-black/40 border-white/10 text-sm h-32 focus:border-indigo-500"
                   />
                ) : (
                  <p className="text-sm font-medium leading-relaxed text-white/70">
                    {task.description || 'No specific metadata provided for this tactical unit.'}
                  </p>
                )}
              </div>

              {/* Checklist Framework */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckSquare className="h-4 w-4 text-[var(--color-accent)]" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Execution Checklist</h3>
                  </div>
                  <span className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] font-black text-[#4F5B76]">
                    {completedSubtasks}/{totalSubtasks}
                  </span>
                </div>

                <div className="space-y-3">
                  {task.subtasks?.map(st => (
                    <div
                      key={st.id}
                      onClick={() => toggleSubtask(st)}
                      className="group flex cursor-pointer items-center justify-between rounded-2xl bg-white/[0.02] border border-white/5 p-4 hover:bg-white/[0.05] transition-all"
                    >
                      <div className="flex items-center gap-4">
                        {st.is_done ? (
                          <div className="h-5 w-5 rounded-lg bg-[var(--color-accent)]/80 flex items-center justify-center text-white scale-110 shadow-lg shadow-[var(--color-accent)]/20 transition-all">
                            <CheckCircle2 className="h-3 w-3" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded-lg border-2 border-white/10 group-hover:border-[var(--color-accent)]/40 transition-all" />
                        )}
                        <span className={`text-sm font-bold tracking-tight transition-all ${st.is_done ? 'text-[#4F5B76] line-through' : 'text-white/80'}`}>
                          {st.title}
                        </span>
                      </div>
                      
                      {st.assigned_user_id && (
                        <div className="h-6 w-6 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-[8px] font-black uppercase text-[#4F5B76]">
                          {profiles.find(p => p.id === st.assigned_user_id)?.full_name.charAt(0) || '?'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tactical Action */}
            <div className="p-8 border-t border-white/5 bg-[#0B0D13]">
              {editing ? (
                 <Button
                    onClick={save}
                    className="h-16 w-full rounded-2xl bg-emerald-500 text-[11px] font-black uppercase tracking-[0.25em] text-white shadow-2xl shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
                  >
                    Authorize Pipeline Update
                  </Button>
              ) : (
                <Button
                  onClick={onClose}
                  className="h-16 w-full rounded-2xl bg-[#3A49F9] text-[11px] font-black uppercase tracking-[0.25em] text-white shadow-2xl shadow-[#3A49F9]/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
                >
                  Return to Canvas
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
