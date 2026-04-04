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
  onTalentClick,
}: {
  status: (typeof KANBAN_COLUMNS)[number]
  tasks: TaskWithRelations[]
  onTaskClick: (id: string) => void
  onTalentClick?: (userId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` })
  
  const statusColor = 
    status === 'pending' ? 'bg-slate-500' :
    status === 'assigned' ? 'bg-blue-500' :
    status === 'in_progress' ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]' :
    status === 'review' ? 'bg-purple-500' :
    status === 'approved' ? 'bg-emerald-500' :
    status === 'scheduled' ? 'bg-cyan-500' :
    status === 'posted' ? 'bg-teal-500' :
    status === 'completed' ? 'bg-emerald-500' :
    'bg-rose-500'

  return (
    <div
      ref={setNodeRef}
      className={`flex w-full flex-col gap-5 rounded-[2.5rem] border border-white/5 bg-white/[0.02] p-6 transition-all duration-300 ${
        isOver ? 'bg-white/[0.05] ring-2 ring-[var(--color-accent)]/20 shadow-2xl shadow-[var(--color-accent)]/5' : ''
      }`}
    >
      <div className="flex items-center justify-between px-2 mb-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${statusColor}`} />
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/90">
            {STATUS_LABEL[status]}
          </h3>
          <span className="flex h-5 items-center justify-center rounded-lg bg-white/5 px-2 text-[9px] font-black text-[#4F5B76] border border-white/5">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button className="flex h-7 w-7 items-center justify-center rounded-lg text-[#4F5B76] hover:bg-white/5 hover:text-white transition-all cursor-pointer">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col gap-4 pr-1">
        {tasks.map((t) => (
          <TaskCard 
            key={t.id} 
            task={t} 
            onClick={() => onTaskClick(t.id)} 
            onTalentClick={onTalentClick}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex-1 border border-dashed border-white/5 rounded-[2rem] opacity-20 flex items-center justify-center">
             <Plus className="h-6 w-6 text-[#4F5B76]" />
          </div>
        )}
      </div>
    </div>
  )
}

export function KanbanBoard({
  tasks,
  onStatusChange,
  onTaskClick,
  onTalentClick,
}: {
  tasks: TaskWithRelations[]
  onStatusChange: (taskId: string, status: TaskWithRelations['status']) => Promise<void>
  onTaskClick: (id: string) => void
  onTalentClick?: (userId: string) => void
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12 pb-12 animate-in fade-in duration-1000">
        {KANBAN_COLUMNS.map((status) => (
          <Column 
            key={status} 
            status={status} 
            tasks={tasks.filter((t) => t.status === status)} 
            onTaskClick={onTaskClick}
            onTalentClick={onTalentClick}
          />
        ))}
      </div>
    </DndContext>
  )
}
