import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import { TaskCard } from './TaskCard'
import { KANBAN_COLUMNS } from '@/lib/taskWorkflow'
import { STATUS_LABEL } from '@/lib/constants'
import type { TaskRow } from '@/types/db'

function Column({
  status,
  tasks,
}: {
  status: (typeof KANBAN_COLUMNS)[number]
  tasks: (TaskRow & { clients?: { name?: string } | null })[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` })
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[280px] w-72 shrink-0 flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 p-3 transition-colors ${
        isOver ? 'ring-2 ring-[var(--color-accent)]/40' : ''
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {STATUS_LABEL[status]}
        </h3>
        <span className="text-xs text-[var(--color-text-muted)]">{tasks.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
      </div>
    </div>
  )
}

export function KanbanBoard({
  tasks,
  onStatusChange,
}: {
  tasks: (TaskRow & { clients?: { name?: string } | null })[]
  onStatusChange: (taskId: string, status: TaskRow['status']) => Promise<void>
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over) return
    const overId = over.id.toString()
    if (!overId.startsWith('col-')) return
    const status = overId.slice(4) as TaskRow['status']
    const taskId = active.id.toString()
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === status) return
    await onStatusChange(taskId, status)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={(ev) => void handleDragEnd(ev)}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((status) => (
          <Column key={status} status={status} tasks={tasks.filter((t) => t.status === status)} />
        ))}
      </div>
    </DndContext>
  )
}
