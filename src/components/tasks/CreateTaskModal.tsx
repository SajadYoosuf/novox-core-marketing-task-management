import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, TextArea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import type { Client, ClientPlatform, Profile, TaskPriority } from '@/types/db'
import { PLATFORM_LABEL, TASK_CONTENT_TYPES, TASK_CONTENT_TYPE_LABELS } from '@/lib/constants'
import type { TaskContentType } from '@/lib/constants'
import { Briefcase, Plus, Clock } from 'lucide-react'

export function CreateTaskModal({
  open,
  onClose,
  userId,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  userId: string | undefined
  onCreated: () => void
}) {
  // Strategic Metadata
  const [clientId, setClientId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority] = useState<TaskPriority>('medium')
  const [deadline, setDeadline] = useState('')
  const [contentType, setContentType] = useState<TaskContentType>('post')

  // Subtask Architecture
  interface SubtaskDraft {
    id: string
    title: string
    platformIds: string[]
    assigneeId: string
  }
  const [subtaskDrafts, setSubtaskDrafts] = useState<SubtaskDraft[]>([])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [currentPlatformIds, setCurrentPlatformIds] = useState<string[]>([])
  const [currentAssigneeId, setCurrentAssigneeId] = useState('')

  // UI State
  const [platformLoading, setPlatformLoading] = useState(false)
  const [platforms, setPlatforms] = useState<ClientPlatform[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [platformMenuOpen, setPlatformMenuOpen] = useState(false)
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false)

  // Subtask Architecture Handlers
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.tactical-dropdown')) {
        setPlatformMenuOpen(false)
        setAssigneeMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleGlobalClick)
    return () => document.removeEventListener('mousedown', handleGlobalClick)
  }, [])



  useEffect(() => {
    if (!open || !supabaseConfigured) return
    void (async () => {
      const { data: c } = await supabase.from('clients').select('*').order('name')
      setClients((c as Client[]) ?? [])
      const { data: p } = await supabase.from('profiles').select('*').order('full_name')
      setProfiles((p as Profile[]) ?? [])
    })()
  }, [open])

  useEffect(() => {
    if (!clientId || !supabaseConfigured) {
      setPlatforms([])
      return
    }
    setPlatformLoading(true)
    void (async () => {
      try {
        const { data } = await supabase
          .from('client_platforms')
          .select('*')
          .eq('client_id', clientId)
          .eq('is_active', true)
        const activePlatforms = (data as ClientPlatform[]) ?? []
        setPlatforms(activePlatforms)
        if (activePlatforms.length > 0) setCurrentPlatformIds(activePlatforms[0].id)
      } finally {
        setPlatformLoading(false)
      }
    })()
  }, [clientId])

  function handleAddSubtask(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && newSubtaskTitle.trim()) {
      e.preventDefault()

      const assignee = profiles.find(p => p.id === currentAssigneeId)
      const isDesigner = assignee?.role === 'designer' || assignee?.role === 'designer_head'

      const draft: SubtaskDraft = {
        id: crypto.randomUUID(),
        title: newSubtaskTitle.trim(),
        platformIds: isDesigner ? [] : currentPlatformIds,
        assigneeId: currentAssigneeId || userId || '',
      }
      setSubtaskDrafts(prev => [...prev, draft])
      setNewSubtaskTitle('')
      // Reset platforms but keep assignee for consecutive additions
      setCurrentPlatformIds([])
    }
  }

  function removeSubtask(id: string) {
    setSubtaskDrafts(prev => prev.filter(s => s.id !== id))
  }


  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabaseConfigured) {
      alert('Supabase connection required.')
      return
    }
    if (!userId) {
      alert('Please log in first.')
      return
    }
    if (!clientId) {
      alert('Please select a client.')
      return
    }
    if (!title.trim()) {
      alert('Please enter a title.')
      return
    }

    try {
      console.log('Creating task...')
      const { data: task, error: tErr } = await supabase
        .from('tasks')
        .insert({
          client_id: clientId,
          title: title.trim(),
          description: description.trim() || null,
          priority,
          content_type: contentType,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          status: subtaskDrafts.length > 0 ? 'in_progress' : 'pending',
          created_by: userId,
        })
        .select('id')
        .single()

      if (tErr) {
        console.error('Task creation failed:', tErr)
        alert(`Failed to create task: ${tErr.message}`)
        return
      }

      if (!task) {
        alert('Failed to create task. Please try again.')
        return
      }

      const taskId = task.id as string
      console.log(`Task ${taskId} created. Adding assignments...`)

      // 1. ALWAYS Insert the primary assignee (at the top levels) into task_assignees
      if (currentAssigneeId && currentAssigneeId.length > 10) {
        const { error: a1Err } = await supabase.from('task_assignees').insert({ task_id: taskId, user_id: currentAssigneeId })
        if (a1Err) console.error('Primary assignee insert warning:', a1Err)
      }

      // 2. Insert subtasks and platform mappings
      let subtasksToInsert = subtaskDrafts.map(d => ({
        task_id: taskId,
        title: d.title,
        client_platform_id: null,
        assigned_user_id: d.assigneeId && d.assigneeId.length > 10 ? d.assigneeId : currentAssigneeId,
        is_done: false,
        status: 'in_progress' as any
      }))

      // If no subtasks were created manually, at least create a primary placeholder for better visibility
      if (subtaskDrafts.length === 0 && currentAssigneeId) {
        subtasksToInsert = [{
          task_id: taskId,
          title: 'Main Work Unit',
          client_platform_id: null,
          assigned_user_id: currentAssigneeId,
          is_done: false,
          status: 'pending' as any
        }]
      }

      if (subtasksToInsert.length > 0) {
        console.log('Inserting subtasks to DB:', subtasksToInsert)
        const { error: sErr } = await supabase.from('subtasks').insert(subtasksToInsert)
        if (sErr) {
          console.error('Subtask database failure:', sErr)
          alert(`CRITICAL DATABASE ERROR: Subtasks were not saved. Message: ${sErr.message}`)
        }

        // Insert into task_platforms junction if it's a marketing subtask with platforms
        const platformRows: any[] = []
        subtaskDrafts.forEach(d => {
          if (d.platformIds.length > 0) {
            d.platformIds.forEach(pid => {
              platformRows.push({
                task_id: taskId,
                client_platform_id: pid,
                assigned_user_id: d.assigneeId || currentAssigneeId,
                status: 'pending' as any
              })
            })
          }
        })

        if (platformRows.length > 0) {
          console.log('Inserting platform assignments:', platformRows)
          const { error: pErr } = await supabase.from('task_platforms').insert(platformRows)
          if (pErr) {
            console.error('Platform assignment DB error:', pErr)
            alert(`PLATFORM ERROR: Assignment failed. Message: ${pErr.message}`)
          }
        }
      }

      // 3. Ensure any other unique assignees from the draft are also in task_assignees
      const otherAssigneeIds = Array.from(new Set(
        subtaskDrafts.map(d => d.assigneeId).filter(id => id && id.length > 10 && id !== currentAssigneeId)
      ))
      if (otherAssigneeIds.length > 0) {
        const { error: aErr } = await supabase.from('task_assignees').insert(
          otherAssigneeIds.map(uid => ({ task_id: taskId, user_id: uid }))
        )
        if (aErr) console.error('Extra assignee insert error:', aErr)
      }

      console.log('Submission successfully sent to DB.')
      onCreated()
      onClose()
      setTitle(''); setDescription(''); setClientId(''); setDeadline('');
      setSubtaskDrafts([]); setNewSubtaskTitle(''); setCurrentPlatformIds([]); setCurrentAssigneeId('');
    } catch (err) {
      console.error('Error creating task:', err)
      alert('Something went wrong. Please try again.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={
      <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em]">
        <span className="opacity-40">Tasks</span>
        <span className="opacity-20">/</span>
        <span>Create New Task</span>
      </div>
    } wide noHeaderStyles>
      <form onSubmit={submit} className="bg-[#0B0D13]/95 text-white p-8 space-y-12 animate-in fade-in duration-500 rounded-[2.5rem] relative z-[50]">

        {/* Metadata Section */}
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4F5B76]">Title *</label>
              <Input
                placeholder="e.g., Q4 Brand Awareness Campaign"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="h-14 bg-black/40 border-[#1E2330] focus:border-[var(--color-accent)] font-bold text-lg placeholder:text-white/10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4F5B76]">Description</label>
              <TextArea
                placeholder="Define the primary objectives..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-black/40 border-[#1E2330] min-h-[160px] font-medium leading-relaxed placeholder:text-white/10"
              />
            </div>
          </div>

          <div className="space-y-8">
            <Select
              label="Client *"
              options={clients.map(c => ({ id: c.id, name: c.name }))}
              value={clientId}
              onChange={setClientId}
              placeholder="Select Client"
              className="group"
            />

            <div className="grid gap-6 sm:grid-cols-2">
              <Select
                label="Category"
                options={TASK_CONTENT_TYPES.map(t => ({ id: t, name: TASK_CONTENT_TYPE_LABELS[t] }))}
                value={contentType}
                onChange={v => setContentType(v as TaskContentType)}
              />
              <DatePicker
                label="Deadline"
                value={deadline}
                onChange={setDeadline}
              />
            </div>
          </div>
        </div>

        {/* Subtask Architecture */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                <Briefcase className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-[0.2em]">Subtasks</h3>
            </div>
            <span className="rounded-lg bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#4F5B76]">
              {subtaskDrafts.length} Added
            </span>
          </div>

          {/* Subtask Input Bar */}
          <div className="relative group">
            <div className="flex items-center gap-4 rounded-2xl border border-[#1E2330] bg-[#161B26]/50 p-2 pl-6 focus-within:border-[var(--color-accent)]/40 transition-all">
              <Plus className="h-4 w-4 text-[var(--color-accent)]" />
              <input
                type="text"
                placeholder="Press Enter to add subtask..."
                value={newSubtaskTitle}
                onChange={e => setNewSubtaskTitle(e.target.value)}
                onKeyDown={handleAddSubtask}
                className="flex-1 bg-transparent py-3 text-sm font-bold focus:outline-none placeholder:text-[#4F5B76]"
              />
              <div className="flex items-center gap-2 pr-2">
                {/* Role-Based Platform Dropdown */}
                <div className="relative tactical-dropdown">
                  <button
                    type="button"
                    onClick={() => {
                      const assignee = profiles.find(p => p.id === currentAssigneeId)
                      const isDesigner = assignee?.role === 'designer' || assignee?.role === 'designer_head'
                      if (isDesigner) return;
                      setPlatformMenuOpen(!platformMenuOpen); setAssigneeMenuOpen(false);
                    }}
                    className={`h-10 min-w-[140px] rounded-xl bg-black/60 border border-white/5 px-4 text-[10px] font-black uppercase text-white/70 hover:text-white hover:border-white/10 transition-all flex items-center justify-between gap-2 cursor-pointer 
                      ${platformLoading ? 'animate-pulse opacity-50' : ''}
                      ${(profiles.find(p => p.id === currentAssigneeId)?.role?.includes('designer')) ? 'opacity-30 grayscale cursor-not-allowed' : ''}
                    `}
                    disabled={platformLoading}
                  >
                    <span className="truncate">
                      {(() => {
                        const assignee = profiles.find(p => p.id === currentAssigneeId)
                        if (assignee?.role?.includes('designer')) return 'Creative (Auto)'
                        if (currentPlatformIds.length === 0) return 'Select Platform'
                        if (currentPlatformIds.length === 1) return PLATFORM_LABEL[platforms.find(p => p.id === currentPlatformIds[0])?.platform as keyof typeof PLATFORM_LABEL] || 'UNIT'
                        return `${currentPlatformIds.length} Platforms Chosen`
                      })()}
                    </span>
                    <Plus className={`h-3 w-3 transition-transform ${platformMenuOpen ? 'rotate-45' : ''}`} />
                  </button>
                  {platformMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 z-[150] w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#161B26] p-2 shadow-2xl animate-in fade-in slide-in-from-top-2">
                      <div className="max-h-48 overflow-y-auto scrollbar-hide py-1 space-y-1">
                        {platforms.length === 0 && (
                          <div className="p-3 text-[9px] font-black uppercase text-[#4F5B76] text-center">No platforms configured</div>
                        )}
                        {platforms.map(p => {
                          const isSelected = currentPlatformIds.includes(p.id)
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className={`flex w-full items-center justify-between px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer text-left
                                ${isSelected
                                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                                  : 'text-white/60 hover:bg-white/5 hover:text-white'
                                }`}
                              onClick={() => {
                                setCurrentPlatformIds(prev =>
                                  prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                )
                              }}
                            >
                              <span>{PLATFORM_LABEL[p.platform as keyof typeof PLATFORM_LABEL] || p.platform.toUpperCase()}</span>
                              {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tactical Assignee Dropdown */}
                <div className="relative tactical-dropdown">
                  <button
                    type="button"
                    onClick={() => { setAssigneeMenuOpen(!assigneeMenuOpen); setPlatformMenuOpen(false); }}
                    className="h-10 min-w-[140px] rounded-xl bg-black/60 border border-white/5 px-4 text-[10px] font-black uppercase text-white/70 hover:text-white hover:border-white/10 transition-all flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="truncate">
                      {profiles.find(p => p.id === currentAssigneeId)?.full_name || 'Assignee'}
                    </span>
                    <Plus className={`h-3 w-3 transition-transform ${assigneeMenuOpen ? 'rotate-45' : ''}`} />
                  </button>
                  {assigneeMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 z-[150] w-48 overflow-hidden rounded-2xl border border-white/10 bg-[#161B26] p-2 shadow-2xl animate-in fade-in slide-in-from-top-2">
                      <div className="max-h-48 overflow-y-auto scrollbar-hide">
                        <button
                          type="button"
                          className="flex w-full items-center px-4 py-2.5 rounded-xl text-[10px] font-black uppercase text-white/60 hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)] transition-all cursor-pointer text-left"
                          onClick={() => { setCurrentAssigneeId(''); setAssigneeMenuOpen(false); }}
                        >
                          Self (Default)
                        </button>
                        {profiles.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            className="flex w-full items-center px-4 py-2.5 rounded-xl text-[10px] font-black uppercase text-white/60 hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)] transition-all cursor-pointer text-left"
                            onClick={() => { setCurrentAssigneeId(p.id); setAssigneeMenuOpen(false); }}
                          >
                            {p.full_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Subtask Units */}
          <div className="space-y-3">
            {subtaskDrafts.map(d => {
              const platform = platforms.find(p => p.id === d.platformId)
              const assignee = profiles.find(p => p.id === d.assigneeId)
              return (
                <div key={d.id} className="group relative flex items-center justify-between rounded-2xl border border-white/5 bg-[#161B26]/30 p-5 pl-7 hover:border-white/10 transition-all">
                  <div className="flex items-center gap-6">
                    <div className="h-2 w-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]" />
                    <div>
                      <h4 className="text-[13px] font-bold text-white/90">{d.title}</h4>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {d.platformIds.length === 0 ? (
                          <span className="rounded-md bg-white/5 border border-white/5 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white/40">
                            Creative Design
                          </span>
                        ) : (
                          d.platformIds.map(pid => {
                            const p = platforms.find(pl => pl.id === pid)
                            return (
                              <span key={pid} className="rounded-md bg-[#EE4667]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-[#EE4667] border border-[#EE4667]/20">
                                {p ? PLATFORM_LABEL[p.platform as keyof typeof PLATFORM_LABEL] : 'General'}
                              </span>
                            )
                          })
                        )}
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#4F5B76] flex items-center gap-1.5 ml-1">
                          <Clock className="h-3 w-3 opacity-40" /> ASAP
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center text-[10px] font-black uppercase">
                        {assignee?.full_name.charAt(0) || '?'}
                      </div>
                      <span className="text-[11px] font-bold text-[#4F5B76]">{assignee?.full_name.split(' ')[0] || 'Unknown'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSubtask(d.id)}
                      className="opacity-0 group-hover:opacity-100 h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-[#4F5B76] hover:text-white transition-all shadow-none cursor-pointer"
                    >
                      <Plus className="h-4 w-4 rotate-45" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-12 border-t border-white/5">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {Array.from(new Set(subtaskDrafts.map(d => d.assigneeId))).slice(0, 3).map(uid => {
                const p = profiles.find(x => x.id === uid)
                return (
                  <div key={uid} className="h-8 w-8 rounded-full border-2 border-[#0B0D13] bg-[var(--color-accent)]/20 flex items-center justify-center text-[9px] font-black uppercase shadow-none">
                    {p?.full_name.charAt(0) || '?'}
                  </div>
                )
              })}
              {subtaskDrafts.length > 3 && (
                <div className="h-8 w-8 rounded-full border-2 border-[#0B0D13] bg-[#161B26] flex items-center justify-center text-[9px] font-black text-[#4F5B76]">
                  +{new Set(subtaskDrafts.map(d => d.assigneeId)).size - 3}
                </div>
              )}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#4F5B76]">Assigned To</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-black uppercase tracking-widest text-[#4F5B76] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <Button
              type="submit"
              className="h-14 px-10 rounded-2xl bg-[#3A49F9] font-black uppercase tracking-[.25em] text-white shadow-2xl shadow-[#3A49F9]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Create Task
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
