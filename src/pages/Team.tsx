import { useCallback, useEffect, useMemo, useState } from 'react'
import { UserPlus, ShieldAlert } from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { inviteEmployee } from '@/lib/inviteEmployee'
import {
  ALL_USER_ROLES,
  HEAD_ASSIGNABLE_ROLES,
  DESIGNER_HEAD_ASSIGNABLE_ROLES,
  ROLE_LABEL,
  canAssignRole,
  canEditProfileRole,
} from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import type { Profile, UserRole } from '@/types/db'

export function Team() {
  const profile = useAuthStore((s) => s.profile)
  const userId = useAuthStore((s) => s.user?.id)
  const isElevated = useAuthStore((s) => s.isElevated())

  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('marketing_executive')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  const actorRole = profile?.role

  const rolesForNewEmployee = useMemo(() => {
    if (actorRole === 'admin') return ALL_USER_ROLES
    if (actorRole === 'marketing_head') return HEAD_ASSIGNABLE_ROLES
    if (actorRole === 'designer_head') return DESIGNER_HEAD_ASSIGNABLE_ROLES
    return []
  }, [actorRole])

  const load = useCallback(async () => {
    if (!supabaseConfigured) {
      setLoading(false)
      setLoadError('Supabase is not configured.')
      return
    }
    setLoading(true)
    setLoadError(null)
    const { data, error } = await supabase.from('profiles').select('*').order('full_name')
    if (error) {
      setLoadError(error.message)
      setMembers([])
    } else {
      setMembers((data as Profile[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (rolesForNewEmployee.length && !rolesForNewEmployee.includes(newRole)) {
      setNewRole(rolesForNewEmployee[0]!)
    }
  }, [rolesForNewEmployee, newRole])

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!canAssignRole(actorRole, newRole)) {
      setFormError('You cannot assign this role.')
      return
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await inviteEmployee({
        email,
        password,
        fullName,
        role: newRole,
      })
      if (error) {
        setFormError(error)
        return
      }
      setFullName('')
      setEmail('')
      setPassword('')
      setNewRole(rolesForNewEmployee[0] ?? 'marketing_executive')
      await load()
      setOpen(false)
      setBanner(
        'Employee added successfully. They can now sign in with the email and password you provided.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function updateMemberRole(member: Profile, nextRole: UserRole) {
    if (!supabaseConfigured || !userId) return
    if (member.id === userId && nextRole !== member.role) {
      const ok = confirm('Change your own role? You may lose access to this screen.')
      if (!ok) return
    }
    if (!canAssignRole(actorRole, nextRole)) return
    if (!canEditProfileRole(actorRole, member.role)) return

    setSavingId(member.id)
    const { error } = await supabase.from('profiles').update({ role: nextRole }).eq('id', member.id)
    setSavingId(null)
    if (error) {
      alert(error.message)
      return
    }
    await load()
    if (member.id === userId) await useAuthStore.getState().fetchProfile(userId)
  }

  function roleOptionsForRow(member: Profile): UserRole[] {
    if (!actorRole) return []
    if (actorRole === 'admin') return ALL_USER_ROLES
    if (actorRole === 'marketing_head' && canEditProfileRole(actorRole, member.role)) {
      return HEAD_ASSIGNABLE_ROLES
    }
    if (actorRole === 'designer_head' && canEditProfileRole(actorRole, member.role)) {
      return DESIGNER_HEAD_ASSIGNABLE_ROLES
    }
    return []
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">Team Members</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Manage your organization's team members and their roles.
          </p>
        </div>
        {isElevated && (
          <Button
            type="button"
            onClick={() => {
              setFormError(null)
              setOpen(true)
            }}
            className="w-full bg-[var(--color-accent)] text-white hover:opacity-90 sm:w-auto"
          >
            <UserPlus className="h-4 w-4 shrink-0" />
            Add Team Member
          </Button>
        )}
      </div>

      {!isElevated ? (
        <Card className="flex gap-3 border-[var(--color-border)] bg-[var(--color-surface-2)]">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-text-muted)]" />
          <p className="text-sm text-[var(--color-text-muted)]">
            Only <strong className="text-[var(--color-text)]">Admin</strong> and{' '}
            <strong className="text-[var(--color-text)]">Marketing Head</strong> can invite people or change roles.
          </p>
        </Card>
      ) : (
        <Card className="border-emerald-500/25 bg-emerald-500/5">
          <p className="text-sm text-[var(--color-text)]">
            <strong>Direct Signup:</strong> When you add a team member, they can log in immediately using the email and password you provided. Please share the temporary password with them securely.
          </p>
        </Card>
      )}

      {banner ? (
        <Card className="flex items-start justify-between gap-3 border-emerald-500/30 bg-emerald-500/10">
          <p className="text-sm text-emerald-900 dark:text-emerald-100">{banner}</p>
          <button
            type="button"
            className="shrink-0 text-sm font-medium text-emerald-800 underline dark:text-emerald-200"
            onClick={() => setBanner(null)}
          >
            Dismiss
          </button>
        </Card>
      ) : null}

      {loadError ? (
        <Card className="border-red-500/40 bg-red-500/10">
          <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
          <Button type="button" variant="secondary" className="mt-2" onClick={() => void load()}>
            Retry
          </Button>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading team…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
              <tr>
                <th className="p-3 font-medium text-[var(--color-text)]">Name</th>
                <th className="p-3 font-medium text-[var(--color-text)]">Email</th>
                <th className="p-3 font-medium text-[var(--color-text)]">Role</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const opts = roleOptionsForRow(m)
                const editable = isElevated && opts.length > 0 && canEditProfileRole(actorRole, m.role)
                return (
                  <tr key={m.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="p-3 font-medium text-[var(--color-text)]">{m.full_name || '—'}</td>
                    <td className="max-w-[200px] truncate p-3 text-[var(--color-text-muted)]">{m.email ?? '—'}</td>
                    <td className="p-3">
                      {editable ? (
                        <select
                          className="w-full max-w-[200px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm"
                          value={m.role}
                          disabled={savingId === m.id}
                          onChange={(e) => void updateMemberRole(m, e.target.value as UserRole)}
                        >
                          {opts.map((r: UserRole) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r] ?? r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[var(--color-text)]">{ROLE_LABEL[m.role] ?? m.role}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add employee" wide>
        <form onSubmit={handleAddEmployee} className="flex flex-col gap-3">
          {formError ? (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {formError}
            </p>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Full name *</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Jane Doe" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Work email *</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="jane@company.com"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
              Temporary password * (min 6 characters)
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Role *</label>
            <select
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
            >
              {rolesForNewEmployee.map((r: UserRole) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r] ?? r}
                </option>
              ))}
            </select>
            {actorRole === 'marketing_head' ? (
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Marketing Heads can only add Marketing Executives and Designers. Ask an Admin to create Admin or Head accounts.
              </p>
            ) : null}
            {actorRole === 'designer_head' ? (
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Designer Heads can only add Designers. Ask an Admin to create Head accounts.
              </p>
            ) : null}
          </div>
          <div className="sticky bottom-0 flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] pt-4 sm:static sm:border-0 sm:pt-0">
            <Button type="submit" className="w-full !text-white" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create account'}
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
