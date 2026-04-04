import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Users, Building2, AlertCircle } from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { TextArea } from '@/components/ui/Input'
import type { Client } from '@/types/db'

export function Clients() {
  const canManage = useAuthStore((s) => s.canManageClients())
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    if (!supabaseConfigured) {
      setLoading(false)
      setLoadError('Supabase is not configured.')
      return
    }
    setLoading(true)
    setLoadError(null)
    const { data, error } = await supabase.from('clients').select('*').order('name')
    if (error) {
      setLoadError(error.message)
      setClients([])
    } else {
      setClients((data as Client[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createClient(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    if (!supabaseConfigured || !user) return
    const { error } = await supabase.from('clients').insert({
      name,
      industry,
      contact_email: email || null,
      contact_phone: phone || null,
      contact_notes: notes || null,
      created_by: user.id,
    })
    if (error) {
      setSaveError(error.message)
      return
    }
    setOpen(false)
    setName('')
    setIndustry('')
    setEmail('')
    setPhone('')
    setNotes('')
    await load()
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">Clients</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Accounts, contacts, and per-channel platform presets.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setOpen(true)} className="w-full shrink-0 sm:w-auto">
            <Plus className="h-4 w-4 shrink-0" />
            New client
          </Button>
        ) : null}
      </div>

      {!canManage ? (
        <Card className="flex gap-3 border-amber-500/30 bg-amber-500/10">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm text-[var(--color-text)]">
            <p className="font-medium">View-only for your role</p>
            <p className="mt-1 text-[var(--color-text-muted)]">
              Only <strong>Admin</strong> and <strong>Marketing Head</strong> can add or edit clients. Ask them to create
              a client record, or request a role change.
            </p>
            {profile?.role ? (
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">Your role: {profile.role.replace('_', ' ')}</p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {loadError ? (
        <Card className="border-red-500/40 bg-red-500/10">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">Could not load clients</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{loadError}</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => void load()}>
            Try again
          </Button>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading clients…</p>
      ) : !loadError && clients.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-accent)]">
            <Users className="h-7 w-7" />
          </div>
          <div className="max-w-sm space-y-2">
            <p className="text-lg font-medium text-[var(--color-text)]">No clients yet</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {canManage
                ? 'Create your first client to attach platforms and tasks.'
                : 'When an admin adds clients, they will appear here.'}
            </p>
          </div>
          {canManage ? (
            <Button type="button" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Add your first client
            </Button>
          ) : null}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {clients.map((c) => (
            <Link key={c.id} to={`/app/clients/${c.id}`} className="block min-h-0">
              <Card className="h-full transition-colors hover:border-[var(--color-accent)]/50">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-text-muted)]" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--color-text)]">{c.name}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">{c.industry || 'Industry not set'}</p>
                    {c.contact_email ? (
                      <p className="mt-2 truncate text-xs text-[var(--color-text-muted)]">{c.contact_email}</p>
                    ) : null}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New client" wide>
        <form onSubmit={createClient} className="flex flex-col gap-3">
          {saveError ? (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {saveError}
            </p>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Name *</label>
            <Input placeholder="Client or brand name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Industry</label>
            <Input placeholder="e.g. Retail, SaaS" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Contact email</label>
            <Input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Contact phone</label>
            <Input placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Notes</label>
            <TextArea placeholder="Internal notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <div className="sticky bottom-0 flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] pt-4 sm:static sm:border-0 sm:pt-0">
            <Button type="submit" className="w-full !text-white">
              Create client
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
