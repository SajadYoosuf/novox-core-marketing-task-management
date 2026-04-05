import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  UserCog,
  KanbanSquare,
  CalendarDays,
  Bell,
  Rocket,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuthStore } from '@/stores/authStore'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]',
  )

export function Sidebar() {
  const profile = useAuthStore((s) => s.profile)

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex min-h-[70px] items-center gap-3 border-b border-[var(--color-border)] px-6 py-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-purple-600 shadow-lg shadow-[var(--color-accent)]/20">
          <Rocket className="h-6 w-6 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold leading-none tracking-tight text-[var(--color-text)]">
            Novox
          </span>
          <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] opacity-60">
            Workflow Manager
          </span>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        <NavLink to="/app/dashboard" className={linkClass}>
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          Dashboard
        </NavLink>
        <NavLink to="/app/clients" className={linkClass}>
          <Users className="h-4 w-4 shrink-0" />
          Clients
        </NavLink>
        <NavLink to="/app/team" className={linkClass}>
          <UserCog className="h-4 w-4 shrink-0" />
          Team
        </NavLink>
        <NavLink to="/app/tasks" className={linkClass}>
          <KanbanSquare className="h-4 w-4 shrink-0" />
          Tasks
        </NavLink>
        <NavLink to="/app/calendar" className={linkClass}>
          <CalendarDays className="h-4 w-4 shrink-0" />
          Calendar
        </NavLink>
        <NavLink to="/app/notifications" className={linkClass}>
          <Bell className="h-4 w-4 shrink-0" />
          Notifications
        </NavLink>
      </nav>
      <div className="border-t border-[var(--color-border)] p-3">
        <p className="truncate text-xs font-medium text-[var(--color-text)]">
          {profile?.full_name ?? 'User'}
        </p>
        <p className="truncate text-xs text-[var(--color-text-muted)]">
          {profile?.role?.replace('_', ' ') ?? ''}
        </p>
      </div>
    </aside>
  )
}
