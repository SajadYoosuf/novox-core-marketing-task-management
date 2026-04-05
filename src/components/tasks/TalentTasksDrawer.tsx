import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { 
  X, 
  Briefcase, 
  Calendar, 
  Clock,
  ExternalLink,
  Users
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { format, parseISO } from 'date-fns'
import type { TaskWithRelations, Profile } from '@/types/db'

interface TalentTasksDrawerProps {
  userId: string | null
  onClose: () => void
  onTaskClick: (taskId: string) => void
}

export function TalentTasksDrawer({ userId, onClose, onTaskClick }: TalentTasksDrawerProps) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId || !supabaseConfigured) return

    setLoading(true)
    void (async () => {
      try {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', userId).single()
        setProfile(p as Profile)

        // Fetch all tasks + subtasks separately to avoid FK join issues
        const { data: allTasks } = await supabase
          .from('tasks')
          .select('*, clients(*)')
          .order('updated_at', { ascending: false })

        const { data: allSubtasks } = await supabase
          .from('subtasks')
          .select('*')

        // Filter to tasks where this user is the creator or assigned via subtasks
        const assembled = (allTasks ?? []).map(t => ({
          ...t,
          subtasks: (allSubtasks ?? []).filter(s => s.task_id === t.id),
          task_assignees: [],
          task_platforms: [],
        })) as TaskWithRelations[]

        const filtered = assembled.filter(task =>
          task.created_by === userId ||
          task.subtasks?.some(s => s.assigned_user_id === userId)
        )

        setTasks(filtered)
      } finally {
        setLoading(false)
      }
    })()
  }, [userId])

  if (!userId) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[100] bg-[#02040A]/60 backdrop-blur-sm animate-in fade-in duration-500" 
        onClick={onClose} 
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-[110] w-full max-w-[480px] bg-[#0B0D13] border-l border-white/5 shadow-2xl shadow-black animate-in slide-in-from-right duration-500">
        <div className="flex h-full flex-col">
          
          {/* Header */}
          <div className="relative p-8 pb-12 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
            <button 
              onClick={onClose}
              className="absolute right-8 top-8 h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-6">
              <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 p-1 shadow-2xl shadow-indigo-500/20">
                <div className="h-full w-full rounded-[20px] bg-slate-900 flex items-center justify-center text-2xl font-black text-white">
                  {profile?.full_name?.charAt(0) || '?'}
                </div>
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-white tracking-tight">{profile?.full_name || 'Syncing Talent...'}</h2>
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-400">
                    {profile?.role || 'Contributor'}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#4F5B76] flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" />
                    {tasks.length} Tactical Units
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Task List */}
          <div className="flex-1 overflow-y-auto p-8 scrollbar-hide space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4F5B76]">Production Pipeline</h3>
              <Clock className="h-4 w-4 text-[#4F5B76] opacity-40" />
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="h-32 w-full animate-pulse rounded-[2rem] bg-white/[0.02] border border-white/5" />
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <div className="h-16 w-16 mx-auto rounded-3xl bg-white/5 flex items-center justify-center border border-white/5">
                  <Briefcase className="h-8 w-8 text-[#4F5B76]/40" />
                </div>
                <p className="text-xs font-bold text-[#4F5B76] italic">No production units detected in this talent's pipeline.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map(task => (
                  <div 
                    key={task.id}
                    onClick={() => onTaskClick(task.id)}
                    className="group relative rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-4">
                       <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400/80 px-2.5 py-1 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                        {task.clients?.name || 'Internal'}
                      </span>
                      {task.deadline && (
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-[#4F5B76]">
                          <Calendar className="h-3 w-3" />
                          {format(parseISO(task.deadline), 'MMM d')}
                        </div>
                      )}
                    </div>
                    
                    <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{task.title}</h4>
                    
                    <div className="mt-6 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <div className={`h-2 w-2 rounded-full ${task.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-500 shadow-[0_0_8px_var(--color-accent)]'}`} />
                         <span className="text-[10px] font-black uppercase tracking-widest text-[#4F5B76]">
                           {task.status.replace('_', ' ')}
                         </span>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-[#4F5B76] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-8 border-t border-white/5 bg-[#0B0D13]">
             <Button 
               onClick={onClose}
               className="w-full h-14 rounded-2xl bg-white/5 border border-white/5 font-black uppercase tracking-[0.2em] text-white hover:bg-white/10 transition-all"
             >
               Discard View
             </Button>
          </div>
        </div>
      </div>
    </>
  )
}
