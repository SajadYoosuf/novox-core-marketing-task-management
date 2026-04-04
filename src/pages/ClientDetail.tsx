import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Building2, Mail, Phone, Target } from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { PLATFORM_LABEL, PLATFORM_ICON } from '@/lib/constants'
import type { Client, ClientPlatform, PlatformType } from '@/types/db'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const ALL_PLATFORMS: PlatformType[] = ['instagram', 'facebook', 'linkedin', 'gmb', 'website']

export function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canManage = useAuthStore((s) => s.canManageClients())
  const [client, setClient] = useState<Client | null>(null)
  const [platforms, setPlatforms] = useState<ClientPlatform[]>([])

  const load = useCallback(async () => {
    if (!supabaseConfigured || !id) return
    const { data: c } = await supabase.from('clients').select('*').eq('id', id).maybeSingle()
    setClient(c as Client)
    const { data: p } = await supabase.from('client_platforms').select('*').eq('client_id', id)
    setPlatforms((p as ClientPlatform[]) ?? [])
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

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
    if (!supabaseConfigured || !id || !confirm('Permanently delete this brand and all its data?')) return
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
      {/* Breadcrumb & Navigation */}
      <Link 
        to="/app/clients" 
        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-all group"
      >
        <span className="group-hover:-translate-x-1 transition-transform">←</span> Return to Brand Directory
      </Link>

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
                <h1 className="text-4xl font-black tracking-tight text-[var(--color-text)] lg:text-6xl">
                  {client.name}
                </h1>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 ring-1 ring-emerald-500/20">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Active Brand Partner</span>
                </div>
              </div>
              <p className="mt-3 text-lg font-medium text-[var(--color-text-muted)] opacity-80 uppercase tracking-widest">
                {client.industry || 'Excellence in Marketing'} Sector
              </p>
            </div>
          </div>
          
          {canManage && (
            <Button 
              variant="secondary" 
              onClick={removeClient}
              className="h-12 rounded-2xl bg-red-500/10 border-red-500/20 px-8 text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-500/20 transition-all"
            >
              Terminate Partnership
            </Button>
          )}
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--color-accent)]/10 blur-[100px]" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-purple-500/10 blur-[100px]" />
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        {/* Left Column: Essential Insights */}
        <div className="lg:col-span-1 space-y-8">
          <div className="space-y-6 rounded-[2rem] bg-black/20 p-8 border border-white/5">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] opacity-60">Brand Intelligence</h3>
            
            <div className="space-y-4">
              <div className="group rounded-2xl bg-white/5 p-5 border border-white/5 transition-all hover:border-[var(--color-accent)]/30">
                <div className="flex items-center gap-3 mb-2">
                  <Mail className="h-4 w-4 text-[var(--color-accent)]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Communications Hub</span>
                </div>
                <p className="text-sm font-bold text-[var(--color-text)] truncate">{client.contact_email || 'No email registered'}</p>
              </div>

              <div className="group rounded-2xl bg-white/5 p-5 border border-white/5 transition-all hover:border-[var(--color-accent)]/30">
                <div className="flex items-center gap-3 mb-2">
                  <Phone className="h-4 w-4 text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Direct Ops Line</span>
                </div>
                <p className="text-sm font-bold text-[var(--color-text)]">{client.contact_phone || 'No phone registered'}</p>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] opacity-60">Internal Strategic Observations</span>
              <div className="min-h-[120px] rounded-2xl bg-white/5 p-5 border border-white/5 text-sm font-medium leading-relaxed text-[var(--color-text)] opacity-80 whitespace-pre-wrap">
                {client.contact_notes || 'No strategic observations recorded for this partner.'}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Platform Multi-Presence */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-[var(--color-accent)]" />
              <h2 className="text-xl font-black tracking-tight text-[var(--color-text)] uppercase">Operational Multi-Presence</h2>
            </div>
            <span className="text-[10px] font-black text-[var(--color-text-muted)] opacity-60 bg-white/5 px-4 py-2 rounded-full border border-white/5">
              {platforms.filter(p => p.is_active).length} Active Channels
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
                  {active ? 'Operational' : 'On Standby'}
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
            placeholder="Official Workspace / Link"
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
                Disable Cache
              </button>
            ) : <div />}
            <Button 
              onClick={() => onSave(handle, link, active)}
              className="h-9 px-6 rounded-lg bg-[var(--color-accent)] text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-[var(--color-accent)]/20"
            >
              Sync Profile
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
