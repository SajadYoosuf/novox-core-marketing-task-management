import { useCallback, useEffect, useState, useMemo } from 'react'
import { UserPlus, ShieldAlert, Search } from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { inviteEmployee } from '@/lib/inviteEmployee'
import {
  ALL_USER_ROLES,
  HEAD_ASSIGNABLE_ROLES,
  DESIGNER_HEAD_ASSIGNABLE_ROLES,
  ROLE_LABEL,
  canAssignRole,
} from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import type { Profile, UserRole } from '@/types/db'

interface MemberStats {
  done: number
  active: number
  pending: number
  performance: number
}

export function Team() {
  const profile = useAuthStore((s) => s.profile)
  const isElevated = useAuthStore((s) => s.isElevated())

  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Search & Filter
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<string>('all')

  // Modal & Form
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('marketing_executive')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  const actorRole = profile?.role
  const rolesForNewEmployee = useMemo(() => {
    if (!actorRole) return []
    // Exclude 'admin' from assignable roles in the team section
    const assignable = ALL_USER_ROLES.filter(r => r !== 'admin') as UserRole[]
    
    if (actorRole === 'admin') return assignable
    if (actorRole === 'marketing_head') return HEAD_ASSIGNABLE_ROLES as UserRole[]
    if (actorRole === 'designer_head') return DESIGNER_HEAD_ASSIGNABLE_ROLES as UserRole[]
    return []
  }, [actorRole])

  const [statsMap, setStatsMap] = useState<Map<string, MemberStats>>(new Map())

  const load = useCallback(async () => {
    if (!supabaseConfigured) {
      setLoading(false)
      setLoadError('Database connection not established.')
      return
    }
    setLoading(true)
    setLoadError(null)

    try {
      const [profRes, logRes, taskRes, assignRes, platformRes] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('performance_logs').select('*'),
        supabase.from('tasks').select('id, status'),
        supabase.from('task_assignees').select('*'),
        supabase.from('task_platforms').select('*')
      ])

      if (profRes.error) {
        setLoadError(profRes.error.message)
      } else {
        setMembers((profRes.data as Profile[]) ?? [])
        const safeLogs = logRes.data ?? []
        const safeTasks = taskRes.data ?? []
        const safeAssignees = assignRes.data ?? []
        const safePlatforms = platformRes.data ?? []

        const map = new Map<string, MemberStats>()
        profRes.data?.forEach(m => {
          const uLogs = safeLogs.filter(l => l.user_id === m.id)
          const legacyDone = uLogs.filter(l => l.event === 'task_completed').length
          const delayed = uLogs.filter(l => l.event === 'task_delayed').length
          const reject = uLogs.filter(l => l.event === 'task_rejected').length

          // Calculate counts based on current task statuses
          const userTaskIds = new Set([
            ...safeAssignees.filter(a => a.user_id === m.id).map(a => a.task_id),
            ...safePlatforms.filter(tp => tp.assigned_user_id === m.id).map(tp => tp.task_id)
          ])

          const userTasks = safeTasks.filter(t => userTaskIds.has(t.id))
          
          const doneCount = userTasks.filter(t => t.status === 'completed' || t.status === 'approved').length
          const activeCount = userTasks.filter(t => 
            t.status === 'assigned' || t.status === 'in_progress' || t.status === 'review'
          ).length
          const pendingCount = userTasks.filter(t => t.status === 'pending').length

          // Maintain performance score logic using legacy logs for historical accuracy
          const total = legacyDone + delayed + reject
          const base = total > 0 ? (legacyDone / total) * 100 : 0
          const performance = total === 0 ? 0 : Math.min(100, Math.round(base + (legacyDone * 2)))

          map.set(m.id, { 
            done: doneCount, 
            active: activeCount, 
            pending: pendingCount, 
            performance 
          })
        })
        setStatsMap(map)
      }
    } catch (err) {
      console.error('Team load error:', err)
      setLoadError('A critical error occurred while loading team data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      // Always exclude admins from the team directory view
      if (m.role === 'admin') return false

      const matchesSearch = m.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (m.email ?? '').toLowerCase().includes(search.toLowerCase())
      const matchesTab = activeTab === 'all' ||
        (activeTab === 'executive' && m.role === 'marketing_executive') ||
        (activeTab === 'designer' && m.role === 'designer') ||
        (activeTab === 'marketing_head' && m.role === 'marketing_head')
      return matchesSearch && matchesTab
    })
  }, [members, search, activeTab])

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!actorRole || !canAssignRole(actorRole, newRole)) {
      setFormError('You cannot assign this role.')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await inviteEmployee({ email, password, fullName, role: newRole })
      if (error) { setFormError(error); return }
      setFullName(''); setEmail(''); setPassword('');
      await load()
      setOpen(false)
      setBanner('Employee onboarded successfully.')
    } finally { setSubmitting(false) }
  }

  if (loading && !members.length) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)] lg:text-5xl">Performance Hub</h1>
            <p className="mt-2 text-[var(--color-text-muted)] text-lg font-medium opacity-80">
              Orchestrating talent across core marketing and design functions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)] transition-colors group-focus-within:text-[var(--color-accent)]" />
            <input
              type="text"
              placeholder="Search members..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-11 w-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 pl-10 pr-4 text-sm ring-[var(--color-accent)]/20 transition-all focus:bg-[var(--color-surface)] focus:ring-4 focus:outline-none"
            />
          </div>
          {isElevated && (
            <Button
              onClick={() => { setFormError(null); setOpen(true) }}
              className="h-11 rounded-xl bg-[var(--color-accent)] px-6 font-bold text-white shadow-xl shadow-[var(--color-accent)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <UserPlus className="h-4 w-4" />
              Add Member
            </Button>
          )}
        </div>
      </div>

      {loadError && (
        <Card className="border-red-500/20 bg-red-500/5 backdrop-blur-xl p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">{loadError}</p>
            <Button variant="secondary" onClick={() => void load()}>Retry</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredMembers.map((m) => {
          const stats = statsMap.get(m.id) || { done: 0, active: 0, pending: 0, performance: 0 }
          const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.full_name}&backgroundColor=b6e3f4,c0aede,d1d4f9`

          return (
            <Card
              key={m.id}
              className="group relative overflow-hidden border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 backdrop-blur-xl transition-all hover:border-[var(--color-accent)]/50 hover:shadow-2xl hover:shadow-[var(--color-accent)]/5"
            >
              <div className="relative z-10 flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="relative h-16 w-16 overflow-hidden rounded-2xl ring-2 ring-[var(--color-border)] transition-all group-hover:ring-[var(--color-accent)]/40">
                    <img src={avatarUrl} alt={m.full_name} className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--color-text)]">{m.full_name}</h3>
                    <p className="text-xs font-black uppercase tracking-widest text-[var(--color-accent)] opacity-80">
                      {ROLE_LABEL[m.role] || m.role}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-[var(--color-text)]">{stats.performance}%</span>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] opacity-60">Performance</p>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <div>
                  <div className="mb-2 flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                    <span>Account Health</span>
                    <span>{stats.performance}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-purple-500 transition-all duration-1000"
                      style={{ width: `${stats.performance}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Done', val: stats.done, color: 'text-emerald-500 bg-emerald-500/5' },
                    { label: 'Active', val: stats.active, color: 'text-indigo-500 bg-indigo-500/5' },
                    { label: 'Pending', val: stats.pending, color: 'text-amber-500 bg-amber-500/5' }
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl p-3 text-center transition-colors group-hover:bg-white/5 ${s.color}`}>
                      <span className="block text-xl font-black">{s.val}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -right-4 -top-4 h-32 w-32 rounded-full bg-[var(--color-accent)] opacity-0 blur-[80px] transition-all group-hover:opacity-10" />
            </Card>
          )
        })}

        {isElevated && (
          <button
            disabled={activeTab !== 'all'}
            onClick={() => { setFormError(null); setOpen(true) }}
            className="group relative flex min-h-[300px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/20 p-8 transition-all hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-2)]/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-2)] ring-1 ring-[var(--color-border)] transition-all group-hover:scale-110 group-hover:ring-[var(--color-accent)]/50">
              <UserPlus className="h-6 w-6 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-[var(--color-text)]">Onboard Member</h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)] text-center max-w-[200px]">Expand your marketing team and track performance</p>
          </button>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Onboard New Talent" wide>
        <form onSubmit={handleAddEmployee} className="grid gap-6 py-4">
          {formError && (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500 font-medium">
              <ShieldAlert className="h-5 w-5" />
              {formError}
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Full name</label>
              <Input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                placeholder="Jane Doe"
                className="h-12 bg-[var(--color-surface-2)]/50 border-[var(--color-border)] focus:ring-[var(--color-accent)]/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Email Address</label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="jane@novox.io"
                className="h-12 bg-[var(--color-surface-2)]/50 border-[var(--color-border)] focus:ring-[var(--color-accent)]/20"
              />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Temporary Password</label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="h-12 bg-[var(--color-surface-2)]/50 border-[var(--color-border)] focus:ring-[var(--color-accent)]/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Primary Role</label>
              <select
                className="h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 px-4 text-sm transition-all focus:border-[var(--color-accent)] focus:outline-none focus:ring-4 focus:ring-[var(--color-accent)]/20"
                value={newRole}
                onChange={e => setNewRole(e.target.value as UserRole)}
              >
                {rolesForNewEmployee.map(r => (
                  <option key={r} value={r}>{ROLE_LABEL[r as UserRole] ?? r}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <Button
              type="submit"
              className="flex-1 h-12 rounded-xl bg-[var(--color-accent)] font-bold text-white shadow-xl shadow-[var(--color-accent)]/20"
              disabled={submitting}
            >
              {submitting ? 'Initializing Account...' : 'Confirm Recruitment'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-12 rounded-xl bg-white/5 border border-white/10"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {banner && (
        <div className="fixed bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-2xl bg-emerald-500 p-4 font-bold text-white shadow-2xl animate-in slide-in-from-bottom-8">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="rounded-lg bg-white/20 p-1 hover:bg-white/30">
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
