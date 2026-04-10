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
import { Plus, ChevronDown, CheckSquare, X } from 'lucide-react'

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

  // Core Team Architecture
  const [designerId, setDesignerId] = useState('')
  const [marketerId, setMarketerId] = useState('')
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([])

  // Subtask Architecture
  interface SubtaskDraft {
    id: string
    title: string
    assigneeId: string
  }
  const [subtaskDrafts, setSubtaskDrafts] = useState<SubtaskDraft[]>([])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [currentAssigneeId, setCurrentAssigneeId] = useState('')

  // UI State
  const [platforms, setPlatforms] = useState<ClientPlatform[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [platformMenuOpen, setPlatformMenuOpen] = useState(false)
  const [designerMenuOpen, setDesignerMenuOpen] = useState(false)
  const [marketerMenuOpen, setMarketerMenuOpen] = useState(false)
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false)

  // Subtask Architecture Handlers
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.tactical-dropdown')) {
        setPlatformMenuOpen(false)
        setDesignerMenuOpen(false)
        setMarketerMenuOpen(false)
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
      const allProfiles = (p as Profile[]) ?? []
      setProfiles(allProfiles)

      // Auto-set initial designer and marketer
      if (allProfiles.length > 0) {
        const designer = allProfiles.find(x => x.role === 'designer' || x.role === 'designer_head')
        const marketer = allProfiles.find(x => x.role === 'marketing_executive' || x.role === 'marketing_head')
        if (designer) setDesignerId(designer.id)
        if (marketer) setMarketerId(marketer.id)
      }
    })()
  }, [open])

  useEffect(() => {
    if (!clientId || !supabaseConfigured) {
      setPlatforms([])
      return
    }
    void (async () => {
      try {
        const { data } = await supabase
          .from('client_platforms')
          .select('*')
          .eq('client_id', clientId)
          .eq('is_active', true)
        const activePlatforms = (data as ClientPlatform[]) ?? []
        setPlatforms(activePlatforms)
        if (activePlatforms.length > 0) setSelectedPlatformIds(activePlatforms.map(p => p.id))
      } finally {
      }
    })()
  }, [clientId])

  function handleAddSubtask(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && newSubtaskTitle.trim()) {
      e.preventDefault()

      const draft: SubtaskDraft = {
        id: crypto.randomUUID(),
        title: newSubtaskTitle.trim(),
        assigneeId: currentAssigneeId || userId || '',
      }
      setSubtaskDrafts(prev => [...prev, draft])
      setNewSubtaskTitle('')
    }
  }

  function removeSubtask(id: string) {
    setSubtaskDrafts(prev => prev.filter(s => s.id !== id))
  }


  const isWebsiteWork = contentType?.startsWith('website_') || contentType?.startsWith('gallery_images')
  const isCustomWork = contentType === 'design_only' || contentType === 'other'

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

    if (isCustomWork) {
      if (subtaskDrafts.length === 0) {
        alert('Please add at least one unit of work (subtask) for custom tasks.')
        return
      }
    } else if (isWebsiteWork) {
      if (!marketerId) {
        alert('Please assign a Website Task Lead.')
        return
      }
    } else {
      if (!designerId) {
        alert('Please assign a Designer.')
        return
      }
      if (!marketerId) {
        alert('Please assign a Marketer.')
        return
      }
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
          deadline: deadline ? new Date(deadline).toISOString() : new Date().toISOString(),
          status: 'pending',
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
      console.log(`Task ${taskId} created. Adding core subtasks...`)

      // 1. Generate Core Subtasks
      const subtasksToInsert: any[] = []

      if (isCustomWork) {
        // Custom work does not generate any preset core subtasks
      } else if (isWebsiteWork) {
        // Website work only gets a single subtask
        subtasksToInsert.push({
          task_id: taskId,
          title: TASK_CONTENT_TYPE_LABELS[contentType] || 'Website Work',
          assigned_user_id: marketerId || userId,
          status: 'pending',
          sort_order: 1,
          is_done: false
        })
      } else {
        // Standard social media workflow
        // Graphic Design Subtask
        if (designerId) {
          subtasksToInsert.push({
            task_id: taskId,
            title: 'Graphic Design',
            assigned_user_id: designerId,
            status: 'pending',
            sort_order: 1,
            is_done: false
          })
        }

        // Platform Posting Subtasks (1 per platform assigned to Marketer)
        selectedPlatformIds.forEach((pid, idx) => {
          const plat = platforms.find(p => p.id === pid)
          subtasksToInsert.push({
            task_id: taskId,
            title: `Post to ${PLATFORM_LABEL[plat?.platform as keyof typeof PLATFORM_LABEL] || 'Platform'}`,
            client_platform_id: pid,
            platform_type: plat?.platform || null,
            assigned_user_id: marketerId,
            status: 'pending',
            sort_order: 2 + idx,
            is_done: false
          })
        })
      }

      // Extra subtasks
      subtaskDrafts.forEach((d, idx) => {
        subtasksToInsert.push({
          task_id: taskId,
          title: d.title,
          assigned_user_id: d.assigneeId,
          status: 'pending',
          sort_order: 10 + idx,
          is_done: false
        })
      })

      if (subtasksToInsert.length > 0) {
        await supabase.from('subtasks').insert(subtasksToInsert)
      }

      // 2. Add all unique assignees to task_assignees for easy notification management
      const uniqueAssignees = Array.from(new Set([
        ...(isWebsiteWork ? [] : [designerId]), 
        marketerId, 
        ...subtaskDrafts.map(d => d.assigneeId)
      ])).filter(id => id && id.length > 10)

      if (uniqueAssignees.length > 0) {
        await supabase.from('task_assignees').insert(
          uniqueAssignees.map(uid => ({ task_id: taskId, user_id: uid }))
        )
      }



      console.log('Submission successfully sent to DB.')
      onCreated()
      onClose()
      setTitle(''); setDescription(''); setClientId(''); setDeadline('');
      setSubtaskDrafts([]); setNewSubtaskTitle(''); setSelectedPlatformIds([]); setDesignerId(''); setMarketerId('');
    } catch (err) {
      console.error('Error creating task:', err)
      alert('Something went wrong. Please try again.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
        <span className="opacity-40">Workflow</span>
        <span className="opacity-20">/</span>
        <span>Create New Task</span>
      </div>
    } wide noHeaderStyles>
      <form onSubmit={submit} className="text-white p-6 lg:p-10 space-y-8 animate-in fade-in zoom-in-95 duration-700 relative z-50">

        {/* Step Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-8">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white tracking-tight">Create New Task</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4F5B76]">Task Setup / Workflow Initialization</p>
          </div>
          <div className="flex h-12 items-center gap-4 rounded-2xl bg-white/5 px-6 border border-white/5">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#4F5B76]">Phase 01</span>
            <div className="h-1 w-12 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-1/3 bg-[var(--color-accent)] animate-pulse" />
            </div>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-12 items-start">

          {/* Left Column: Metadata Context */}
          <div className="lg:col-span-12 space-y-8">
            <div className="grid gap-6 lg:grid-cols-3 p-6 rounded-[1.5rem] bg-white/[0.02] border border-white/5 shadow-inner">
              {/* Client & Content Info */}
              <div className="lg:col-span-2 space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4F5B76] pl-3">Task Title *</label>
                  <Input
                    placeholder="Enter a punchy message..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="h-12 bg-black/40 border-white/5 focus:border-[var(--color-accent)] font-bold text-lg placeholder:text-white/5 tracking-tight rounded-xl transition-all"
                  />
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Select
                    label="Target Client *"
                    options={clients.map(c => ({ id: c.id, name: c.name }))}
                    value={clientId}
                    onChange={setClientId}
                    placeholder="Select Client"
                  />
                  <Select
                    label="Content Strategy"
                    options={TASK_CONTENT_TYPES.map(t => ({ id: t, name: TASK_CONTENT_TYPE_LABELS[t] }))}
                    value={contentType}
                    onChange={v => setContentType(v as TaskContentType)}
                  />
                </div>
              </div>

              {/* Brief & Deadline */}
              <div className="space-y-8 lg:border-l lg:border-white/5 lg:pl-10">
                <DatePicker
                  label="Launch Deadline"
                  value={deadline}
                  onChange={setDeadline}
                />
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4F5B76] pl-4">Brief / Intent</label>
                  <TextArea
                    placeholder="Creative guidelines..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-black/20 border-white/5 min-h-[100px] font-medium leading-relaxed placeholder:text-white/5 rounded-2xl p-4 focus:border-[var(--color-accent)]/40 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SQUAD ASSIGNMENT SECTION */}
          {!isCustomWork && (
          <div className="lg:col-span-12 space-y-6 pt-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-[1px] flex-1 bg-white/5" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#4F5B76]">Production Squad</h3>
              <div className="h-[1px] flex-1 bg-white/5" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Designer Block */}
              {!isWebsiteWork && (
                <div className="relative tactical-dropdown group">
                  <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-r from-amber-500/20 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500" />
                  <button
                    type="button"
                    onClick={() => { setDesignerMenuOpen(!designerMenuOpen); setMarketerMenuOpen(false); setPlatformMenuOpen(false); }}
                    className={`relative w-full flex items-center justify-between gap-4 rounded-[1.5rem] border transition-all cursor-pointer p-5 ${designerMenuOpen ? 'border-amber-500/40 bg-amber-500/5 ring-4 ring-amber-500/5' : 'border-white/5 bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.05]'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all ${designerId ? 'bg-amber-500 text-white shadow-[0_5px_15px_rgba(245,158,11,0.3)]' : 'bg-white/5 text-[#4F5B76]'}`}>
                        <Plus className={`h-5 w-5 transition-transform ${designerMenuOpen ? 'rotate-45' : ''}`} />
                      </div>
                      <div className="text-left space-y-0.5">
                        <p className="text-[9px] font-black uppercase text-amber-500/80 tracking-widest">Creative Intelligence</p>
                        <p className="text-base font-black text-white leading-tight">{profiles.find(p => p.id === designerId)?.full_name || 'Assign Designer'}</p>
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-[#4F5B76] transition-transform ${designerMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {designerMenuOpen && (
                    <div className="absolute top-full left-0 mt-3 z-[160] w-full overflow-hidden rounded-[2rem] border border-white/10 bg-[#161B26] p-3 shadow-2xl animate-in fade-in slide-in-from-top-2">
                      <div className="max-h-56 overflow-y-auto scrollbar-hide py-1 space-y-1">
                        {profiles.filter(p => p.role.includes('desig')).map(p => (
                          <button
                            key={p.id}
                            type="button"
                            className={`flex w-full items-center gap-4 px-5 py-4 rounded-2xl text-[10px] font-black uppercase transition-all cursor-pointer text-left
                              ${designerId === p.id ? 'bg-amber-500 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                            onClick={() => { setDesignerId(p.id); setDesignerMenuOpen(false); }}
                          >
                            <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center text-[10px]">{p.full_name.charAt(0)}</div>
                            <span>{p.full_name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Marketer Block */}
              <div className={`relative tactical-dropdown group ${isWebsiteWork ? 'lg:col-span-2' : ''}`}>
                <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-r from-blue-500/20 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500" />
                <div className="flex gap-4 items-stretch">
                  <button
                    type="button"
                    onClick={() => { setMarketerMenuOpen(!marketerMenuOpen); setDesignerMenuOpen(false); setPlatformMenuOpen(false); }}
                    className={`relative flex-1 flex items-center justify-between gap-4 rounded-[1.5rem] border transition-all cursor-pointer p-5 ${marketerMenuOpen ? 'border-blue-500/40 bg-blue-500/5 ring-4 ring-blue-500/5' : 'border-white/5 bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.05]'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all ${marketerId ? 'bg-blue-500 text-white shadow-[0_5px_15px_rgba(59,130,246,0.3)]' : 'bg-white/5 text-[#4F5B76]'}`}>
                        <Plus className={`h-5 w-5 transition-transform ${marketerMenuOpen ? 'rotate-45' : ''}`} />
                      </div>
                      <div className="text-left space-y-0.5">
                        <p className="text-[9px] font-black uppercase text-blue-500/80 tracking-widest">{isWebsiteWork ? 'Website Task Lead' : 'Growth Execution'}</p>
                        <p className="text-base font-black text-white leading-tight">{profiles.find(p => p.id === marketerId)?.full_name || (isWebsiteWork ? 'Assign Lead' : 'Assign Marketer')}</p>
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-[#4F5B76] transition-transform ${marketerMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Platform Selector (Compact) */}
                  {!isWebsiteWork && (
                    <button
                      type="button"
                      onClick={() => { setPlatformMenuOpen(!platformMenuOpen); setDesignerMenuOpen(false); setMarketerMenuOpen(false); }}
                      className={`min-w-[100px] rounded-[1.5rem] border transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${platformMenuOpen ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/5 bg-white/[0.03] hover:border-white/10'}`}
                    >
                      <div className="flex -space-x-2">
                        {selectedPlatformIds.length > 0 ? selectedPlatformIds.slice(0, 3).map(id => {
                          const p = platforms.find(x => x.id === id)?.platform
                          return (
                            <div key={id} className="h-6 w-6 rounded-full bg-[#0B0D13] border border-white/10 flex items-center justify-center shadow-lg">
                              {p === 'instagram' ? <X className="h-3 w-3 text-pink-500" /> : <Plus className="h-3 w-3 text-white/40" />}
                            </div>
                          )
                        }) : <Plus className="h-4 w-4 text-[#4F5B76]" />}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#4F5B76]">
                        {selectedPlatformIds.length || 'Select'}
                      </span>
                    </button>
                  )}
                </div>

                {marketerMenuOpen && (
                  <div className="absolute top-full left-0 mt-3 z-[160] w-full overflow-hidden rounded-[2rem] border border-white/10 bg-[#161B26] p-3 shadow-2xl animate-in fade-in slide-in-from-top-2">
                    <div className="max-h-56 overflow-y-auto scrollbar-hide py-1 space-y-1">
                      {profiles.filter(p => p.role.includes('mark')).map(p => (
                        <button
                          key={p.id}
                          type="button"
                          className={`flex w-full items-center gap-4 px-5 py-4 rounded-2xl text-[10px] font-black uppercase transition-all cursor-pointer text-left
                              ${marketerId === p.id ? 'bg-blue-500 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                          onClick={() => { setMarketerId(p.id); setMarketerMenuOpen(false); }}
                        >
                          <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center text-[10px]">{p.full_name.charAt(0)}</div>
                          <span>{p.full_name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!isWebsiteWork && platformMenuOpen && (
                  <div className="absolute top-full right-0 mt-3 z-[160] w-64 overflow-hidden rounded-[2rem] border border-white/10 bg-[#161B26] p-3 shadow-2xl animate-in fade-in slide-in-from-top-2">
                    <div className="max-h-64 overflow-y-auto scrollbar-hide py-1 space-y-1">
                      {platforms.length === 0 && (
                        <div className="p-8 text-[9px] font-black uppercase text-[#4F5B76] text-center leading-relaxed">Please select a Target Client to enable multi-platform targeting</div>
                      )}
                      {platforms.map(p => {
                        const isSelected = selectedPlatformIds.includes(p.id)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`flex w-full items-center justify-between px-5 py-4 rounded-2xl text-[10px] font-black uppercase transition-all cursor-pointer text-left
                                ${isSelected ? 'bg-emerald-500 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                            onClick={() => {
                              setSelectedPlatformIds(prev =>
                                prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                              )
                            }}
                          >
                            <span>{PLATFORM_LABEL[p.platform as keyof typeof PLATFORM_LABEL] || p.platform}</span>
                            {isSelected && <CheckSquare className="h-4 w-4" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Operational Workflow Section */}
          <div className="lg:col-span-12 space-y-8 pt-8">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#4F5B76]">Tactical Units & Assets</h3>
              <span className="text-[10px] font-black text-[var(--color-accent)]">{subtaskDrafts.length} CUSTOM UNITS</span>
            </div>

            <div className="relative group">
              <div className="flex items-center gap-4 rounded-[1.5rem] border border-white/5 bg-white/[0.02] p-2 pl-6 focus-within:border-[var(--color-accent)]/40 focus-within:bg-white/[0.04] transition-all shadow-inner">
                <Plus className="h-4 w-4 text-[var(--color-accent)]" />
                <input
                  type="text"
                  placeholder="Insert special requirements..."
                  value={newSubtaskTitle}
                  onChange={e => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={handleAddSubtask}
                  className="flex-1 bg-transparent py-3 text-sm font-bold focus:outline-none placeholder:text-[#4F5B76]/40"
                />

                <div className="relative tactical-dropdown pr-2">
                  <button
                    type="button"
                    onClick={() => { setAssigneeMenuOpen(!assigneeMenuOpen); setPlatformMenuOpen(false); setDesignerMenuOpen(false); }}
                    className="h-10 min-w-[160px] rounded-xl bg-black/40 border border-white/10 px-4 text-[10px] font-black uppercase text-white/50 hover:text-white hover:border-white/20 transition-all flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <span className="truncate">
                      {profiles.find(p => p.id === currentAssigneeId)?.full_name || 'Assign Talent'}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${assigneeMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {assigneeMenuOpen && (
                    <div className="absolute top-full right-0 mt-3 z-[150] w-56 overflow-hidden rounded-[2rem] border border-white/10 bg-[#161B26] p-2 shadow-2xl animate-in fade-in slide-in-from-top-2">
                      <div className="max-h-56 overflow-y-auto scrollbar-hide py-1 space-y-1">
                        {profiles.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            className="flex w-full items-center px-5 py-3 rounded-xl text-[10px] font-black uppercase text-white/60 hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)] transition-all cursor-pointer text-left"
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subtaskDrafts.map(d => {
                const assignee = profiles.find(p => p.id === d.assigneeId)
                return (
                  <div key={d.id} className="group relative flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:bg-white/[0.04] animate-in zoom-in-95">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center text-[12px] font-black text-[var(--color-accent)]">
                        {assignee?.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-black text-white/90 tracking-tight">{d.title}</p>
                        <p className="text-[9px] font-black text-[#4F5B76] uppercase tracking-widest mt-0.5">{assignee?.full_name}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => removeSubtask(d.id)} className="h-8 w-8 flex items-center justify-center rounded-lg text-[#4F5B76] hover:text-rose-500 hover:bg-rose-500/10 transition-all">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Action Floor */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-12 border-t border-white/5 gap-8">
          <div className="flex items-center gap-6">
            <div className="flex -space-x-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-8 w-8 rounded-full border-4 border-[#0B0D13] bg-white/5" />
              ))}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#4F5B76]">Global Operations: Ready for Broadcast</span>
          </div>

          <div className="flex items-center gap-8 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] font-black uppercase tracking-[0.2em] text-[#4F5B76] hover:text-white transition-colors cursor-pointer"
            >
              Terminate
            </button>
            <Button
              type="submit"
              className="h-12 flex-1 sm:flex-none px-8 rounded-2xl bg-[var(--color-accent)] font-black uppercase tracking-[0.3em] text-white shadow-[0_10px_20px_rgba(58,73,249,0.3)] hover:scale-[1.03] active:scale-[0.98] transition-all"
            >
              Commence Workflow
            </Button>
          </div>
        </div>
      </form>

    </Modal>
  )
}
