import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  UserCog,
  KanbanSquare,
  Table2,
  CalendarDays,
  Bell,
  Sparkles,
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
      <div className="flex min-h-14 items-center gap-2 border-b border-[var(--color-border)] px-4 py-2">
        <Sparkles className="h-6 w-6 shrink-0 text-[var(--color-accent)]" />
        <span className="text-sm font-semibold leading-tight tracking-tight text-[var(--color-text)]">
          Novox Core Marketing
        </span>
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
        <NavLink to="/app/tasks/table" className={linkClass}>
          <Table2 className="h-4 w-4 shrink-0" />
          Table
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
