import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { 
  GripVertical, 
  Calendar, 
  Camera, 
  Globe,
  Share2,
  Briefcase
} from 'lucide-react'
import type { TaskWithRelations } from '@/types/db'
import { format, parseISO } from 'date-fns'

const PlatformIcon = ({ platform }: { platform?: string }) => {
  const p = platform?.toLowerCase()
  if (p === 'instagram') return <Camera className="h-3 w-3 text-pink-500" />
  if (p === 'facebook') return <Share2 className="h-3 w-3 text-blue-600" />
  if (p === 'linkedin') return <Briefcase className="h-3 w-3 text-blue-700" />
  if (p === 'gmb') return <Share2 className="h-3 w-3 text-emerald-500" />
  return <Globe className="h-3 w-3 text-[var(--color-text-muted)]" />
}

interface TaskCardProps {
  task: TaskWithRelations
  onClick: () => void
  onTalentClick?: (userId: string) => void
}

export function TaskCard({ task, onClick, onTalentClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  // Synchronize unique assignees from both task-level and subtasks
  const uniqueAssigneeIds = Array.from(new Set([
    ...(task.task_assignees?.map(a => a.user_id) || []),
    ...(task.subtasks?.filter(s => s.assigned_user_id).map(s => s.assigned_user_id!) || [])
  ]))

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }

  // Calculate subtask progress
  const totalSubtasks = task.subtasks?.length || 0
  const completedSubtasks = task.subtasks?.filter(s => s.is_done).length || 0
  const progressPercent = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0


  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...listeners} 
      {...attributes}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="group relative cursor-pointer"
    >
      <div
        className="block overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[#0B0D13]/80 backdrop-blur-xl p-5 shadow-2xl shadow-black/20 transition-all duration-500 hover:border-[var(--color-accent)]/40 hover:shadow-indigo-500/5 active:scale-[0.98]"
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
      >
        {/* Content Type Ribbon */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[var(--color-accent)]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--color-accent)] border border-[var(--color-accent)]/10">
              {task.content_type?.replace('_', ' ') || 'CREATIVE'}
            </span>
            {task.priority === 'high' && (
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rose-500]" />
            )}
          </div>
          <GripVertical className="h-4 w-4 cursor-grab text-[#4F5B76] opacity-40 transition-opacity hover:opacity-100" />
        </div>

        <div className="space-y-1.5">
          <h4 className="text-[15px] font-black leading-tight text-white tracking-tight group-hover:text-indigo-400 transition-colors">
            {task.title}
          </h4>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#4F5B76]">
            {task.clients?.name || 'SYNCING...'}
          </p>
        </div>

        {/* Unified Subtask List (Design + Marketing) */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div className="mt-4 space-y-1.5 border-l-2 border-white/5 pl-4 py-1">
            {task.subtasks.slice(0, 4).map(st => {
              const assignee = st.profiles || null
              const isPlatform = (st as any).is_platform
              return (
                <div key={st.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${st.is_done ? 'bg-emerald-500/40' : (isPlatform ? 'bg-blue-500' : 'bg-indigo-500')}`} />
                    <span className={`text-[10px] font-bold truncate ${st.is_done ? 'text-[#4F5B76] line-through' : 'text-white/70'}`}>
                      {st.title}
                    </span>
                  </div>
                  {assignee && (
                    <span className="text-[8px] font-black uppercase text-[#4F5B76] tracking-tighter whitespace-nowrap bg-white/5 px-1.5 py-0.5 rounded-md">
                      {assignee.full_name.split(' ')[0]}
                    </span>
                  )}
                </div>
              )
            })}
            {task.subtasks.length > 4 && (
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#4F5B76] opacity-40 ml-4 pt-1">
                + {task.subtasks.length - 4} units more
              </p>
            )}
          </div>
        )}

        {/* Subtask Progress */}
        {totalSubtasks > 0 && (
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-[9px] font-black uppercase tracking-[0.2em] text-[#4F5B76]">
              <span>Execution</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-700" 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>
          </div>
        )}

        {/* Platform Badges */}
        {task.task_platforms && task.task_platforms.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {task.task_platforms.map(tp => {
              const platform = (tp.client_platforms as any)?.platform
              if (!platform) return null
              return (
                <div key={tp.id} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1 transition-all group-hover:border-white/10">
                  <PlatformIcon platform={platform} />
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/50">
                    {platform}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-5">
          <div className="flex -space-x-1.5">
            {uniqueAssigneeIds.length > 0 ? (
               uniqueAssigneeIds.slice(0, 3).map(aid => {
                  const profile = task.task_assignees?.find(a => a.user_id === aid)?.profiles || 
                                 task.subtasks?.find(s => s.assigned_user_id === aid)?.profiles
                  return (
                    <div 
                      key={aid}
                      onClick={(e) => { e.stopPropagation(); onTalentClick?.(aid); }}
                      className="h-7 w-7 rounded-full border-2 border-[#0B0D13] bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px] cursor-pointer hover:scale-110 hover:z-30 transition-all shadow-xl"
                    >
                      <div className="h-full w-full rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-black text-white/80">
                        {profile?.full_name.charAt(0) || '?'}
                      </div>
                    </div>
                  )
               })
            ) : (
              <div className="h-7 w-7 rounded-full border-2 border-[#0B0D13] bg-white/5 flex items-center justify-center">
                <GripVertical className="h-3 w-3 text-[#4F5B76]/40" />
              </div>
            )}
            {uniqueAssigneeIds.length > 3 && (
              <div className="h-7 w-7 rounded-full border-2 border-[#0B0D13] bg-[#161B26] flex items-center justify-center text-[9px] font-black text-[#4F5B76]">
                +{uniqueAssigneeIds.length - 3}
              </div>
            )}
          </div>
          
          {task.deadline && (
             <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#4F5B76] opacity-60">
               <Calendar className="h-3.5 w-3.5" />
               <span className="mt-0.5">{format(parseISO(task.deadline), 'MMM d')}</span>
             </div>
          )}
        </div>
      </div>
    </div>
  )
}
