import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { TextArea } from '@/components/ui/Input'
import type { Client, ClientPlatform, Profile, TaskPriority } from '@/types/db'
import { PLATFORM_LABEL, TASK_CONTENT_TYPES, TASK_CONTENT_TYPE_LABELS } from '@/lib/constants'
import type { TaskContentType } from '@/lib/constants'

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
  const [clients, setClients] = useState<Client[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [clientId, setClientId] = useState('')
  const [platforms, setPlatforms] = useState<ClientPlatform[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set())
  const [assignees, setAssignees] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [deadline, setDeadline] = useState('')
  const [publishDate, setPublishDate] = useState('')
  const [contentType, setContentType] = useState<TaskContentType>('static')
  const [subtaskText, setSubtaskText] = useState('')

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
    void (async () => {
      const { data } = await supabase
        .from('client_platforms')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
      setPlatforms((data as ClientPlatform[]) ?? [])
      setSelectedPlatforms(new Set())
    })()
  }, [clientId])

  useEffect(() => {
    if (contentType === 'video' || contentType === 'reel') {
      const lines = subtaskText.split('\n').map((s) => s.trim())
      if (!lines.some((l) => l.toLowerCase().includes('thumbnail'))) {
        setSubtaskText((prev) => (prev ? `${prev}\nCreate Thumbnail` : 'Create Thumbnail'))
      }
    }
  }, [contentType])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabaseConfigured || !userId || !clientId || !title.trim()) return

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        client_id: clientId,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        content_type: contentType,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        publish_date: publishDate ? new Date(publishDate).toISOString() : null,
        status: assignees.size > 0 ? 'assigned' : 'pending',
        created_by: userId,
      })
      .select('id')
      .single()

    if (error || !task) {
      console.error(error)
      return
    }

    const taskId = task.id as string

    for (const uid of assignees) {
      await supabase.from('task_assignees').insert({ task_id: taskId, user_id: uid })
    }

    for (const cpId of selectedPlatforms) {
      await supabase.from('task_platforms').insert({
        task_id: taskId,
        client_platform_id: cpId,
        assigned_user_id: null,
        status: 'pending',
        submission_required: true,
      })
    }

    const lines = subtaskText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    for (let i = 0; i < lines.length; i++) {
      await supabase.from('subtasks').insert({
        task_id: taskId,
        title: lines[i],
        sort_order: i,
      })
    }

    onCreated()
    onClose()
    setTitle('')
    setDescription('')
    setClientId('')
    setDeadline('')
    setPublishDate('')
    setSubtaskText('')
    setAssignees(new Set())
    setSelectedPlatforms(new Set())
  }

  return (
    <Modal open={open} onClose={onClose} title="New task" wide>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Client</label>
            <select
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)]"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Content Type</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {TASK_CONTENT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setContentType(t)}
                  className={`rounded-md border p-2 text-center text-xs transition-colors ${
                    contentType === t
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 font-medium text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'
                  }`}
                >
                  {TASK_CONTENT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Task Title</label>
            <Input placeholder="e.g. Summer Collection Launch" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Priority</label>
            <select
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-accent)]"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Deadline</label>
            <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Publish date</label>
            <Input type="datetime-local" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
          </div>
        </div>
        <TextArea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-text)]">Platforms (Select target channels)</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {platforms.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  selectedPlatforms.has(p.id)
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                    : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                  checked={selectedPlatforms.has(p.id)}
                  onChange={(e) => {
                    const next = new Set(selectedPlatforms)
                    if (e.target.checked) next.add(p.id)
                    else next.delete(p.id)
                    setSelectedPlatforms(next)
                  }}
                />
                <span className="text-xs font-medium text-[var(--color-text)]">
                  {PLATFORM_LABEL[p.platform]}
                </span>
              </label>
            ))}
            {platforms.length === 0 ? (
              <span className="col-span-full text-xs text-[var(--color-text-muted)] italic">
                No active platforms configured for this client.
              </span>
            ) : null}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-text)]">Assignees</p>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-[var(--color-border)] p-2">
            {profiles.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={assignees.has(p.id)}
                  onChange={(e) => {
                    const next = new Set(assignees)
                    if (e.target.checked) next.add(p.id)
                    else next.delete(p.id)
                    setAssignees(next)
                  }}
                />
                {p.full_name}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Subtasks (one per line)</label>
          <TextArea value={subtaskText} onChange={(e) => setSubtaskText(e.target.value)} placeholder="Video edit&#10;Thumbnail&#10;Caption" />
        </div>
        <Button type="submit">Create task</Button>
      </form>
    </Modal>
  )
}
