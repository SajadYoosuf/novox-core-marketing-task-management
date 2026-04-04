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
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${task ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-[450px] border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl transition-transform duration-500 ease-out sm:max-w-[500px] ${task ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
          </div>
        ) : task ? (
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] p-6">
              <h2 className="text-xl font-bold text-[var(--color-text)]">Task Details</h2>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text)] transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-8 space-y-8">
              {/* Status & Title */}
              <div className="space-y-4">
                <div className="inline-block">
                  <StatusBadge status={task.status} />
                </div>
                <h1 className="text-3xl font-black leading-tight tracking-tight text-[var(--color-text)]">
                  {task.title}
                </h1>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-[var(--color-surface-2)]/50 p-4 border border-[var(--color-border)]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] opacity-60">Assignee</span>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-purple-600 p-[2px]">
                      <div className="h-full w-full rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white">
                        {profiles.find(p => p.id === task.task_assignees?.[0]?.user_id)?.full_name?.charAt(0) || 'U'}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-[var(--color-text)]">
                      {profiles.find(p => p.id === task.task_assignees?.[0]?.user_id)?.full_name || 'Unassigned'}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-[var(--color-surface-2)]/50 p-4 border border-[var(--color-border)]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] opacity-60">Deadline</span>
                  <div className="mt-3 flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-rose-500" />
                    <span className="text-sm font-bold text-[var(--color-text)]">
                      {task.deadline ? format(parseISO(task.deadline), 'MMM d, yyyy') : 'No date'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-muted)] opacity-60">Description</h3>
                <p className="text-sm leading-relaxed text-[var(--color-text)] opacity-80">
                  {task.description || 'No Task brief provided for this task.'}
                </p>
              </div>

              {/* Checklist */}
              <div className="rounded-3xl bg-black/20 p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--color-text)]">
                    Checklist ({task.subtasks?.filter(s => s.is_done).length}/{task.subtasks?.length})
                  </h3>
                  <CheckSquare className="h-4 w-4 text-[var(--color-text-muted)]" />
                </div>

                <div className="space-y-3">
                  {task.subtasks?.map(st => (
                    <div
                      key={st.id}
                      onClick={() => toggleSubtask(st)}
                      className="flex cursor-pointer items-center gap-4 group"
                    >
                      {st.is_done ? (
                        <CheckCircle2 className="h-5 w-5 text-[var(--color-accent)]" />
                      ) : (
                        <Circle className="h-5 w-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
                      )}
                      <span className={`text-sm font-medium transition-all ${st.is_done ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>
                        {st.title}
                      </span>
                    </div>
                  ))}
                  {(!task.subtasks || task.subtasks.length === 0) && (
                    <p className="text-xs text-[var(--color-text-muted)] italic">No subtasks defined.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Action */}
            <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-8">
              <Button
                onClick={onClose}
                className="h-12 w-full rounded-2xl bg-[var(--color-accent)] text-sm font-black uppercase tracking-widest text-white shadow-2xl shadow-[var(--color-accent)]/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                Update Task
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
