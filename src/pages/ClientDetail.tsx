import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Building2, Mail, Phone, Target, Edit2, Trash2 } from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { PLATFORM_LABEL, PLATFORM_ICON } from '@/lib/constants'
import type { Client, ClientPlatform, PlatformType } from '@/types/db'
import { Button } from '@/components/ui/Button'
import { Input, TextArea } from '@/components/ui/Input'

const ALL_PLATFORMS: PlatformType[] = ['instagram', 'facebook', 'linkedin', 'gmb', 'website']

export function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canManage = useAuthStore((s) => s.canManageClients())
  const [client, setClient] = useState<Client | null>(null)
  const [platforms, setPlatforms] = useState<ClientPlatform[]>([])

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    name: '',
    industry: '',
    contact_email: '',
    contact_phone: '',
    contact_notes: '',
  })

  const load = useCallback(async () => {
    if (!supabaseConfigured || !id) return
    const { data: c } = await supabase.from('clients').select('*').eq('id', id).maybeSingle()
    const clientData = c as Client
    setClient(clientData)
    if (clientData) {
      setDraft({
        name: clientData.name || '',
        industry: clientData.industry || '',
        contact_email: clientData.contact_email || '',
        contact_phone: clientData.contact_phone || '',
        contact_notes: clientData.contact_notes || '',
      })
    }
    const { data: p } = await supabase.from('client_platforms').select('*').eq('client_id', id)
    setPlatforms((p as ClientPlatform[]) ?? [])
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  function startEdit() {
    if (!client) return
    setDraft({
      name: client.name || '',
      industry: client.industry || '',
      contact_email: client.contact_email || '',
      contact_phone: client.contact_phone || '',
      contact_notes: client.contact_notes || '',
    })
    setEditing(true)
  }

  async function saveEdit() {
    if (!supabaseConfigured || !id) return
    await supabase.from('clients').update({
      name: draft.name.trim(),
      industry: draft.industry.trim(),
      contact_email: draft.contact_email.trim() || null,
      contact_phone: draft.contact_phone.trim() || null,
      contact_notes: draft.contact_notes.trim() || null,
    }).eq('id', id)
    setEditing(false)
    await load()
  }

  function cancelEdit() {
    setEditing(false)
    if (client) {
      setDraft({
        name: client.name || '',
        industry: client.industry || '',
        contact_email: client.contact_email || '',
        contact_phone: client.contact_phone || '',
        contact_notes: client.contact_notes || '',
      })
    }
  }

  async function upsertPlatform(platform: PlatformType, patch: Partial<ClientPlatform>) {
    if (!supabaseConfigured || !id) return
    const existing = platforms.find((x) => x.platform === platform)
    if (existing) {
      await supabase.from('client_platforms').update(patch).eq('id', existing.id)
    } else {
      await supabase.from('client_platforms').insert({
        client_id: id,
        platform,
        is_active: true,
        ...patch,
      })
    }
    await load()
  }

  async function removeClient() {
    if (!supabaseConfigured || !id || !confirm('Are you sure you want to delete this client? This cannot be undone.')) return
    await supabase.from('clients').delete().eq('id', id)
    navigate('/app/clients')
  }

  async function removePlatform(platformId: string) {
    if (!supabaseConfigured || !confirm('Are you sure you want to remove this platform?')) return
    await supabase.from('client_platforms').delete().eq('id', platformId)
    await load()
  }

  if (!client) {
    return (
      <div className="text-[var(--color-text-muted)]">
        Loading…{' '}
        <Link to="/app/clients" className="text-[var(--color-accent)]">
          Back
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-10 animate-in fade-in duration-700">
      {/* Top Bar: Back + Actions */}
      <div className="flex items-center justify-between">
        <Link 
          to="/app/clients" 
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-all group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Clients
        </Link>

        <div className="flex items-center gap-3">
          {editing ? (
            <>
              <Button
                onClick={cancelEdit}
                className="h-11 rounded-2xl bg-white/5 border border-white/10 px-6 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] hover:bg-white/10 transition-all"
              >
                Cancel
              </Button>
              <Button
                onClick={() => void saveEdit()}
                className="h-11 rounded-2xl bg-[var(--color-accent)] px-8 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-[var(--color-accent)]/20 hover:opacity-90 transition-all"
              >
                Update
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={startEdit}
                className="h-11 rounded-2xl bg-white/5 border border-white/10 px-6 text-xs font-bold uppercase tracking-widest text-[var(--color-text)] hover:bg-white/10 hover:border-[var(--color-accent)]/30 transition-all flex items-center gap-2"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                onClick={() => void removeClient()}
                className="h-11 rounded-2xl bg-red-500/10 border border-red-500/20 px-6 text-xs font-bold uppercase tracking-widest text-red-500 hover:bg-red-500/20 transition-all flex items-center gap-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-[var(--color-surface-2)]/30 border border-white/5 p-10 backdrop-blur-2xl">
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-8">
            <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-[var(--color-accent)] to-purple-600 shadow-2xl shadow-[var(--color-accent)]/20 p-[2px]">
              <div className="flex h-full w-full items-center justify-center rounded-[2rem] bg-[var(--color-surface)]">
                <Building2 className="h-10 w-10 text-[var(--color-accent)]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3">
                {editing ? (
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="text-4xl font-black bg-black/40 border-white/10 lg:text-5xl h-16"
                    placeholder="Client name"
                  />
                ) : (
                  <h1 className="text-4xl font-black tracking-tight text-[var(--color-text)] lg:text-6xl">
                    {client.name}
                  </h1>
                )}
                {!editing && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 ring-1 ring-emerald-500/20">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Active</span>
                  </div>
                )}
              </div>
              {editing ? (
                <Input
                  value={draft.industry}
                  onChange={(e) => setDraft({ ...draft, industry: e.target.value })}
                  className="mt-3 bg-black/40 border-white/10 text-sm"
                  placeholder="Industry (e.g. Technology, Healthcare)"
                />
              ) : (
                <p className="mt-3 text-lg font-medium text-[var(--color-text-muted)] opacity-80 uppercase tracking-widest">
                  {client.industry || 'No industry set'}
                </p>
              )}
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--color-accent)]/10 blur-[100px]" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-purple-500/10 blur-[100px]" />
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        {/* Left Column: Client Info */}
        <div className="lg:col-span-1 space-y-8">
          <div className="space-y-6 rounded-[2rem] bg-black/20 p-8 border border-white/5">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] opacity-60">Client Details</h3>
            
            <div className="space-y-4">
              <div className="group rounded-2xl bg-white/5 p-5 border border-white/5 transition-all hover:border-[var(--color-accent)]/30">
                <div className="flex items-center gap-3 mb-2">
                  <Mail className="h-4 w-4 text-[var(--color-accent)]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Email</span>
                </div>
                {editing ? (
                  <Input
                    type="email"
                    value={draft.contact_email}
                    onChange={(e) => setDraft({ ...draft, contact_email: e.target.value })}
                    className="bg-black/40 border-white/10 text-sm"
                    placeholder="client@example.com"
                  />
                ) : (
                  <p className="text-sm font-bold text-[var(--color-text)] truncate">{client.contact_email || 'No email added'}</p>
                )}
              </div>

              <div className="group rounded-2xl bg-white/5 p-5 border border-white/5 transition-all hover:border-[var(--color-accent)]/30">
                <div className="flex items-center gap-3 mb-2">
                  <Phone className="h-4 w-4 text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Phone</span>
                </div>
                {editing ? (
                  <Input
                    value={draft.contact_phone}
                    onChange={(e) => setDraft({ ...draft, contact_phone: e.target.value })}
                    className="bg-black/40 border-white/10 text-sm"
                    placeholder="+91 98765 43210"
                  />
                ) : (
                  <p className="text-sm font-bold text-[var(--color-text)]">{client.contact_phone || 'No phone added'}</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] opacity-60">Notes</span>
              {editing ? (
                <TextArea
                  value={draft.contact_notes}
                  onChange={(e) => setDraft({ ...draft, contact_notes: e.target.value })}
                  className="min-h-[120px] bg-black/40 border-white/10 text-sm"
                  placeholder="Add notes about this client..."
                />
              ) : (
                <div className="min-h-[120px] rounded-2xl bg-white/5 p-5 border border-white/5 text-sm font-medium leading-relaxed text-[var(--color-text)] opacity-80 whitespace-pre-wrap">
                  {client.contact_notes || 'No notes added yet.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Platforms */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-[var(--color-accent)]" />
              <h2 className="text-xl font-black tracking-tight text-[var(--color-text)] uppercase">Platforms</h2>
            </div>
            <span className="text-[10px] font-black text-[var(--color-text-muted)] opacity-60 bg-white/5 px-4 py-2 rounded-full border border-white/5">
              {platforms.filter(p => p.is_active).length} Active
            </span>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {ALL_PLATFORMS.map((p) => {
              const row = platforms.find((x) => x.platform === p)
              const Icon = PLATFORM_ICON[p]
              return (
                <PlatformRow
                  key={p}
                  label={PLATFORM_LABEL[p]}
                  icon={Icon}
                  canManage={canManage}
                  row={row}
                  onSave={(handle, link, isActive) => {
                    void upsertPlatform(p, {
                      account_handle: handle || null,
                      account_link: link || null,
                      is_active: isActive,
                    })
                  }}
                  onRemove={row ? () => void removePlatform(row.id) : undefined}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function PlatformRow({
  label,
  icon: Icon,
  canManage,
  row,
  onSave,
  onRemove,
}: {
  label: string
  icon: ComponentType<{ className?: string }>
  canManage: boolean
  row?: ClientPlatform
  onSave: (handle: string, link: string, isActive: boolean) => void
  onRemove?: () => void
}) {
  const [handle, setHandle] = useState(row?.account_handle ?? '')
  const [link, setLink] = useState(row?.account_link ?? '')
  const [active, setActive] = useState(row?.is_active ?? false)

  useEffect(() => {
    setHandle(row?.account_handle ?? '')
    setLink(row?.account_link ?? '')
    setActive(row?.is_active ?? false)
  }, [row])

  return (
    <div className={`relative overflow-hidden rounded-[2rem] border transition-all duration-500 ${active ? 'border-[var(--color-accent)]/30 bg-[var(--color-surface-2)]/40 shadow-xl shadow-[var(--color-accent)]/5' : 'border-white/5 bg-black/20 opacity-60'}`}>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${active ? 'bg-[var(--color-accent)] text-white' : 'bg-white/5 text-[var(--color-text-muted)]'}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-[var(--color-text)]">{label}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-white/20'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                  {active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
          
          {canManage && (
            <label className="relative inline-flex cursor-pointer items-center">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="peer sr-only" />
              <div className="h-5 w-9 rounded-full bg-white/10 transition-all peer-checked:bg-[var(--color-accent)] after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
            </label>
          )}
        </div>

        <div className="grid gap-3">
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-[var(--color-accent)] opacity-60">@</span>
            <Input
              placeholder="Account Handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              disabled={!canManage}
              className="h-10 bg-black/20 border-white/5 pl-8 text-xs font-bold"
            />
          </div>
          <Input
            placeholder="Profile Link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            disabled={!canManage}
            className="h-10 bg-black/20 border-white/5 text-xs font-medium"
          />
        </div>

        {canManage && (
          <div className="flex items-center justify-between pt-2">
            {row && onRemove ? (
              <button onClick={onRemove} className="text-[10px] font-black uppercase tracking-widest text-red-500/60 hover:text-red-500 transition-colors">
                Remove
              </button>
            ) : <div />}
            <Button 
              onClick={() => onSave(handle, link, active)}
              className="h-9 px-6 rounded-lg bg-[var(--color-accent)] text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-[var(--color-accent)]/20"
            >
              Save
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
