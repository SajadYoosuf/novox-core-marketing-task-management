import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, Building2, Mail, Phone, MoreHorizontal } from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input, TextArea } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'
import type { Client } from '@/types/db'

export function Clients() {
  const user = useAuthStore((s) => s.user)
  const isElevated = useAuthStore((s) => s.isElevated())
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [activeClient, setActiveClient] = useState<Client | null>(null)

  // Form state
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!supabaseConfigured) return
    const { data } = await supabase.from('clients').select('*').order('name')
    setClients((data as Client[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (editingClient) {
      setName(editingClient.name)
      setIndustry(editingClient.industry)
      setEmail(editingClient.contact_email || '')
      setPhone(editingClient.contact_phone || '')
      setNotes(editingClient.contact_notes || '')
    } else {
      setName(''); setIndustry(''); setEmail(''); setPhone(''); setNotes('');
    }
  }, [editingClient])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry.toLowerCase().includes(search.toLowerCase())
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !supabaseConfigured) return
    setSubmitting(true)

    if (editingClient) {
      await supabase.from('clients').update({
        name,
        industry,
        contact_email: email,
        contact_phone: phone,
        contact_notes: notes,
      }).eq('id', editingClient.id)
    } else {
      await supabase.from('clients').insert({
        name,
        industry,
        contact_email: email,
        contact_phone: phone,
        contact_notes: notes,
        created_by: user.id
      })
    }

    setName(''); setIndustry(''); setEmail(''); setPhone(''); setNotes('');
    setEditingClient(null)
    setOpen(false)
    setSubmitting(false)
    await load()
  }

  async function handleDelete(id: string) {
    if (!supabaseConfigured || !confirm('Permanently delete this client and all associated data?')) return
    await supabase.from('clients').delete().eq('id', id)
    await load()
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)] lg:text-5xl">Client Directory</h1>
          <p className="mt-3 text-lg font-medium text-[var(--color-text-muted)] opacity-80 leading-relaxed">
            Managing {clients.length} brand relations and assets
          </p>
        </div>

        {isElevated && (
          <Button
            onClick={() => setOpen(true)}
            className="h-11 rounded-xl bg-[var(--color-accent)] px-8 font-bold text-white shadow-xl shadow-[var(--color-accent)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4" />
            Add New Client
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-[var(--color-surface-2)]/50 px-4 py-2 border border-[var(--color-border)] shadow-sm">
            <Building2 className="h-4 w-4 text-[var(--color-accent)]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text)]">Active Accounts</span>
          </div>
        </div>

        <div className="relative group min-w-[300px]">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-accent)]" />
          <input
            type="text"
            placeholder="Search Tasks or brand names..."
            className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 pl-11 pr-4 text-sm font-bold text-[var(--color-text)] ring-[var(--color-accent)]/20 transition-all focus:bg-[var(--color-surface)] focus:ring-4 focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-[400px] w-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <Card
              key={c.id}
              onClick={() => { setActiveClient(c); setInfoOpen(true); }}
              className="group relative overflow-hidden border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-0 backdrop-blur-xl transition-all duration-300 hover:border-[var(--color-accent)]/50 hover:shadow-2xl hover:shadow-[var(--color-accent)]/5 cursor-pointer"
            >
              <div className="bg-gradient-to-r from-[var(--color-accent)]/10 to-transparent p-6 pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-surface)] shadow-lg ring-1 ring-white/10">
                    <Building2 className="h-7 w-7 text-[var(--color-accent)]" />
                  </div>

                </div>
                <div className="mt-4">
                  <h3 className="text-xl font-bold tracking-tight text-[var(--color-text)] transition-colors group-hover:text-[var(--color-accent)]">
                    {c.name}
                  </h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--color-accent)] opacity-80 mt-1">
                    {c.industry || 'General Marketing'}
                  </p>
                </div>
              </div>

              <div className="p-6 pt-4 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs font-medium text-[var(--color-text-muted)]">
                    <Mail className="h-3.5 w-3.5 opacity-60" />
                    {c.contact_email || 'No email registered'}
                  </div>
                  <div className="flex items-center gap-3 text-xs font-medium text-[var(--color-text-muted)]">
                    <Phone className="h-3.5 w-3.5 opacity-60" />
                    {c.contact_phone || 'No phone registered'}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                    <span className="text-[10px] font-bold text-[var(--color-text-muted)]">Active Account</span>
                  </div>
                  <Button
                    variant="secondary"
                    className="h-8 rounded-lg bg-white/5 border-white/5 px-4 text-[10px] font-black uppercase tracking-widest text-[var(--color-text)] hover:bg-white/10 transition-all pointer-events-none"
                  >
                    Details
                  </Button>
                </div>
              </div>

              {/* Decorative accent */}
              <div className="absolute -right-4 -bottom-4 h-32 w-32 rounded-full bg-[var(--color-accent)] opacity-0 blur-[80px] transition-all group-hover:opacity-[0.05]" />
            </Card>
          ))}

          {isElevated && (
            <button
              onClick={() => setOpen(true)}
              className="group relative flex min-h-[300px] flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/20 p-8 transition-all hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-2)]/40 cursor-pointer"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-surface-2)] ring-1 ring-[var(--color-border)] transition-all group-hover:scale-110 group-hover:bg-[var(--color-accent)]/10 group-hover:ring-[var(--color-accent)]/50">
                <Plus className="h-8 w-8 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
              </div>
              <h3 className="mt-6 text-lg font-bold text-[var(--color-text)]">New Partnership</h3>
              <p className="mt-2 text-sm text-[var(--color-text-muted)] text-center max-w-[200px]">Expand your brand portfolio and Task scope</p>
            </button>
          )}
        </div>
      )}

      {/* Client Insight Modal */}
      <Modal open={infoOpen} onClose={() => setInfoOpen(false)} title="Client Brand Profile" wide>
        {activeClient && (
          <div className="space-y-8 py-4">
            <div className="flex items-start justify-between border-b border-white/5 pb-6">
              <div className="flex items-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10 ring-1 ring-[var(--color-accent)]/20 shadow-xl shadow-[var(--color-accent)]/5">
                  <Building2 className="h-8 w-8 text-[var(--color-accent)]" />
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-[var(--color-text)]">{activeClient.name}</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-accent)] opacity-80 mt-1">
                    {activeClient.industry || 'General Marketing'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {isElevated && (
                  <>
                    <Button
                      variant="secondary"
                      className="h-10 rounded-xl bg-white/5 border-white/10 font-bold px-5 hover:bg-white/10"
                      onClick={() => { setEditingClient(activeClient); setInfoOpen(false); setOpen(true); }}
                    >
                      Refine Brand
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-10 rounded-xl bg-red-500/10 border-red-500/20 text-red-500 font-bold px-5 hover:bg-red-500/20"
                      onClick={() => { handleDelete(activeClient.id); setInfoOpen(false); }}
                    >
                      Terminate
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-8 sm:grid-cols-2">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--color-text-muted)] opacity-60">
                    <Mail className="h-3 w-3" /> Point of Contact
                  </label>
                  <p className="text-sm font-bold text-[var(--color-text)] bg-white/5 p-4 rounded-xl border border-white/5">
                    {activeClient.contact_email || 'No email on file'}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--color-text-muted)] opacity-60">
                    <Phone className="h-3 w-3" /> Direct Line
                  </label>
                  <p className="text-sm font-bold text-[var(--color-text)] bg-white/5 p-4 rounded-xl border border-white/5">
                    {activeClient.contact_phone || 'No phone on file'}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--color-text-muted)] opacity-60">
                  <MoreHorizontal className="h-3 w-3" /> Notes
                </label>
                <div className="text-sm font-medium leading-relaxed text-[var(--color-text)]/80 bg-white/5 p-4 rounded-xl border border-white/5 min-h-[140px] whitespace-pre-wrap">
                  {activeClient.contact_notes || 'No notes added yet.'}
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-center">
              <a
                href={`/app/clients/${activeClient.id}`}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-accent)] hover:underline underline-offset-8"
              >
                View Full Assets & Platforms Account →
              </a>
            </div>
          </div>
        )}
      </Modal>

      {/* Add/Edit Client Modal */}
      <Modal open={open} onClose={() => { setOpen(false); setEditingClient(null); }} title={editingClient ? "Refine Client Details" : "New Client Account"} wide>
        <form onSubmit={handleSubmit} className="grid gap-6 py-4">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--color-text-muted)] opacity-60">Brand Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Novox International" className="h-12 bg-[var(--color-surface-2)]/50 border-[var(--color-border)]" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--color-text-muted)] opacity-60">Industry Sector</label>
              <Input value={industry} onChange={e => setIndustry(e.target.value)} required placeholder="Marketing Technology" className="h-12 bg-[var(--color-surface-2)]/50 border-[var(--color-border)]" />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--color-text-muted)] opacity-60">Point of Contact (Email)</label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@brand.io" className="h-12 bg-[var(--color-surface-2)]/50 border-[var(--color-border)]" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--color-text-muted)] opacity-60">Direct Line</label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="h-12 bg-[var(--color-surface-2)]/50 border-[var(--color-border)]" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--color-text-muted)] opacity-60">Notes</label>
            <TextArea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Key objectives, brand guidelines links..." rows={3} className="bg-[var(--color-surface-2)]/50 border-[var(--color-border)]" />
          </div>

          <div className="mt-4 flex gap-3">
            <Button type="submit" disabled={submitting} className="flex-1 h-12 rounded-2xl bg-[var(--color-accent)] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-[var(--color-accent)]/20">
              {submitting ? (editingClient ? 'Refining...' : 'Creating...') : (editingClient ? 'Save Changes' : 'Confirm Registration')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} className="h-12 rounded-2xl bg-white/5 border-white/5 font-black uppercase tracking-[0.2em]">
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
