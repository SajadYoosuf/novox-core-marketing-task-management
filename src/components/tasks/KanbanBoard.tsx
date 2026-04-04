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
import type { TaskWithRelations } from '@/types/db'
import { Plus, MoreHorizontal } from 'lucide-react'

function Column({
  status,
  tasks,
  onTaskClick,
}: {
  status: (typeof KANBAN_COLUMNS)[number]
  tasks: TaskWithRelations[]
  onTaskClick: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` })
  
  const statusColor = 
    status === 'pending' ? 'bg-slate-500' :
    status === 'assigned' ? 'bg-blue-500' :
    status === 'in_progress' ? 'bg-indigo-500' :
    status === 'review' ? 'bg-purple-500' :
    status === 'approved' ? 'bg-emerald-500' :
    status === 'scheduled' ? 'bg-cyan-500' :
    status === 'posted' ? 'bg-teal-500' :
    status === 'completed' ? 'bg-emerald-500' :
    'bg-rose-500'

  return (
    <div
      ref={setNodeRef}
      className={`flex w-80 shrink-0 flex-col gap-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/30 p-4 transition-all duration-300 ${
        tasks.length === 0 ? 'min-h-[150px]' : 'min-h-0'
      } ${
        isOver ? 'bg-[var(--color-surface-2)]/50 ring-2 ring-[var(--color-accent)]/20' : ''
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${statusColor} shadow-[0_0_8px_rgba(var(--color-accent-rgb),0.5)]`} />
          <h3 className="text-sm font-bold tracking-tight text-[var(--color-text)]">
            {STATUS_LABEL[status]}
          </h3>
          <span className="flex h-5 items-center justify-center rounded-lg bg-white/5 px-2 text-[10px] font-black text-[var(--color-text-muted)] border border-white/5">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {status !== 'pending' && (
            <button className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text)] transition-all">
              <Plus className="h-4 w-4" />
            </button>
          )}
          <button className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text)] transition-all">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t.id)} />
        ))}
      </div>
    </div>
  )
}

export function KanbanBoard({
  tasks,
  onStatusChange,
  onTaskClick,
}: {
  tasks: TaskWithRelations[]
  onStatusChange: (taskId: string, status: TaskWithRelations['status']) => Promise<void>
  onTaskClick: (id: string) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint: { distance: 6 } 
    })
  )

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over) return
    const overId = over.id.toString()
    if (!overId.startsWith('col-')) return
    const status = overId.slice(4) as TaskWithRelations['status']
    const taskId = active.id.toString()
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === status) return
    await onStatusChange(taskId, status)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={(ev) => void handleDragEnd(ev)}>
      <div className="flex gap-6 overflow-x-auto pb-8 scrollbar-hide">
        {KANBAN_COLUMNS.map((status) => (
          <Column 
            key={status} 
            status={status} 
            tasks={tasks.filter((t) => t.status === status)} 
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
    </DndContext>
  )
}
