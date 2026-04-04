import { useEffect, useState, useCallback } from 'react'
import {
  X,
  Calendar,
  CheckCircle2,
  Circle,
  CheckSquare
} from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
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
  const [profiles, setProfiles] = useState<Profile[]>([])

  const loadTask = useCallback(async () => {
    if (!supabaseConfigured || !taskId) return
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('*, clients(*), task_assignees(*), task_platforms(*, client_platforms(platform)), subtasks(*)')
      .eq('id', taskId)
      .maybeSingle()

    setTask(data as TaskWithRelations)

    const { data: p } = await supabase.from('profiles').select('*').order('full_name')
    setProfiles((p as Profile[]) ?? [])
    setLoading(false)
  }, [taskId])

  useEffect(() => {
    if (taskId) void loadTask()
  }, [taskId, loadTask])

  const toggleSubtask = async (st: Subtask) => {
    if (!supabaseConfigured) return
    await supabase.from('subtasks').update({ is_done: !st.is_done }).eq('id', st.id)
    void loadTask()
    onUpdate()
  }

  if (!taskId) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[100] bg-[#02040A]/60 backdrop-blur-sm transition-all duration-500 ${task ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-[110] h-full w-full max-w-[520px] border-l border-white/5 bg-[#0B0D13] shadow-2xl transition-transform duration-500 ease-out ${task ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
          </div>
        ) : task ? (
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="relative p-8 pb-12 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
              <button 
                onClick={onClose}
                className="absolute right-8 top-8 h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="space-y-4">
                <div className="inline-flex items-center gap-2">
                  <span className="rounded-lg bg-[var(--color-accent)]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--color-accent)] border border-[var(--color-accent)]/10">
                    {task.content_type?.replace('_', ' ') || 'PRODUCTION UNIT'}
                  </span>
                  <div className={`h-2 w-2 rounded-full ${task.priority === 'high' ? 'bg-rose-500 shadow-[0_0_8px_rose-500]' : 'bg-blue-500'}`} />
                </div>
                <h2 className="text-3xl font-black text-white tracking-tight leading-tight">{task.title}</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-8 space-y-10">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4F5B76]">Projected Goal</span>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-[#EE4667]" />
                    <span className="text-sm font-bold text-white/90">
                      {task.deadline ? format(parseISO(task.deadline), 'MMM d, yyyy') : 'Indefinite Pipeline'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-right">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4F5B76]">Lead Brand</span>
                  <p className="text-sm font-bold text-white/90 truncate">{task.clients?.name || 'Internal Strategy'}</p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-3 p-6 rounded-3xl bg-white/[0.02] border border-white/5">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4F5B76]">Strategic Brief</span>
                <p className="text-sm font-medium leading-relaxed text-white/70">
                  {task.description || 'No specific metadata provided for this tactical unit.'}
                </p>
              </div>

              {/* Checklist Infrastructure */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckSquare className="h-4 w-4 text-[var(--color-accent)]" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Production Checklist</h3>
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

            {/* Footer Action */}
            <div className="p-8 border-t border-white/5 bg-[#0B0D13]">
              <Button
                onClick={onClose}
                className="h-16 w-full rounded-2xl bg-[#3A49F9] text-[11px] font-black uppercase tracking-[0.25em] text-white shadow-2xl shadow-[#3A49F9]/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                Restore Canvas
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
