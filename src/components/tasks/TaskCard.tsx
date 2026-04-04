import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/ui/Badge'
import type { TaskRow } from '@/types/db'
import { format } from 'date-fns'

export function TaskCard({ task }: { task: TaskRow & { clients?: { name?: string } | null } }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.85 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Link
        to={`/app/tasks/${task.id}`}
        onClick={(e) => e.stopPropagation()}
        className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-[var(--color-text)]">{task.title}</p>
          <StatusBadge status={task.status} />
        </div>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{task.clients?.name ?? 'Client'}</p>
        {task.deadline ? (
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Due {format(new Date(task.deadline), 'MMM d, yyyy')}
          </p>
        ) : null}
      </Link>
    </div>
  )
}
