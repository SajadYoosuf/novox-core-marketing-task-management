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
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }

  // Calculate subtask progress
  const totalSubtasks = task.subtasks?.length || 0
  const completedSubtasks = task.subtasks?.filter(s => s.is_done).length || 0
  const progressPercent = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0

  // Get primary platform
  const primaryPlatform = task.task_platforms?.[0]?.client_platforms?.platform

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...listeners} 
      {...attributes}
      onClick={(e) => {
        // Prevent click from triggering if dragging start was intended 
        // though dnd-kit handles this, explicit onClick is safer for drawer
        e.stopPropagation()
        onClick()
      }}
      className="group relative cursor-pointer"
    >
      <div
        className="block overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm transition-all duration-300 hover:border-[var(--color-accent)]/30 hover:shadow-xl hover:shadow-[var(--color-accent)]/5 active:scale-[0.98]"
      >
        {/* Content Type Ribbon */}
        {task.content_type && (
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-md bg-[var(--color-accent)]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[var(--color-accent)]">
              {task.content_type.replace('_', ' ')}
            </span>
            <GripVertical className="h-3.5 w-3.5 cursor-grab text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        )}

        <div className="space-y-1">
          <h4 className="text-sm font-bold leading-snug text-[var(--color-text)] transition-colors group-hover:text-[var(--color-accent)]">
            {task.title}
          </h4>
          <p className="text-[11px] font-medium text-[var(--color-text-muted)]">
            Client: <span className="text-[var(--color-text)] opacity-80">{task.clients?.name || 'Internal'}</span>
          </p>
        </div>

        {/* Subtask Progress */}
        {totalSubtasks > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-tight text-[var(--color-text-muted)]">
              <span>Subtasks</span>
              <span>{completedSubtasks}/{totalSubtasks}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
              <div 
                className="h-full bg-gradient-to-r from-[var(--color-accent)] to-purple-500 transition-all duration-500" 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>
          </div>
        )}

        {/* Platform Badge */}
        {primaryPlatform && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--color-surface-2)]/50 border border-[var(--color-border)] px-2.5 py-1 transition-all group-hover:border-[var(--color-accent)]/20">
            <PlatformIcon platform={primaryPlatform} />
            <span className="text-[10px] font-bold capitalize text-[var(--color-text)]">
              {primaryPlatform}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-dashed border-[var(--color-border)] pt-4">
          <div className="flex -space-x-2">
            <div className="h-6 w-6 rounded-full border-2 border-[var(--color-surface)] bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px]">
              <div className="h-full w-full rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white">
                {task.title.charAt(0)}
              </div>
            </div>
          </div>
          
          {task.deadline && (
             <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-text-muted)]">
               <Calendar className="h-3 w-3" />
               {format(parseISO(task.deadline), 'MMM d')}
             </div>
          )}
        </div>
      </div>
    </div>
  )
}
