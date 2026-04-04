import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { PLATFORM_LABEL, PLATFORM_ICON } from '@/lib/constants'
import type { Client, ClientPlatform, PlatformType } from '@/types/db'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PlatformBadge } from '@/components/ui/Badge'

const ALL_PLATFORMS: PlatformType[] = ['instagram', 'facebook', 'linkedin', 'gmb', 'website']

export function ClientDetail() {
  const { id } = useParams<{ id: string }>()
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
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/app/clients" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)]">
        ← Clients
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">{client.name}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{client.industry}</p>
        <p className="mt-2 text-sm text-[var(--color-text)]">
          {[client.contact_email, client.contact_phone].filter(Boolean).join(' · ') || 'No contact on file'}
        </p>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">Platforms</h2>
        <p className="mb-4 text-xs text-[var(--color-text-muted)]">
          Only active platforms can be attached to tasks. Toggle and save handles/links per channel.
        </p>
        <div className="space-y-4">
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
      </Card>
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
    <div className="rounded-lg border border-[var(--color-border)] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <PlatformBadge label={label} icon={Icon} />
        <span
          className={
            active
              ? 'text-xs font-medium text-emerald-600 dark:text-emerald-400'
              : 'text-xs text-[var(--color-text-muted)]'
          }
        >
          {active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          placeholder="Handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          disabled={!canManage}
        />
        <Input
          placeholder="Profile / property URL"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          disabled={!canManage}
        />
      </div>
      {canManage ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active for tasks
          </label>
          <Button type="button" onClick={() => onSave(handle, link, active)}>
            Save
          </Button>
          {row && onRemove && (
            <Button type="button" variant="secondary" onClick={onRemove} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10">
              Remove
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}
