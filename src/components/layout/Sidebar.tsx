import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  UserCog,
  KanbanSquare,
  CalendarDays,
  Bell,
  Rocket,
  X,
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

export function Sidebar({ 
  isOpen, 
  onClose 
}: { 
  isOpen?: boolean; 
  onClose?: () => void 
}) {
  const profile = useAuthStore((s) => s.profile)

  return (
    <aside className={clsx(
      "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-transform duration-300 ease-in-out sm:relative sm:translate-x-0",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="flex min-h-[70px] items-center justify-between border-b border-[var(--color-border)] px-6 py-2">
        <div className="flex items-center gap-3">
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
        {/* Mobile Close Button */}
        <button 
          onClick={onClose}
          className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] sm:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {[
          { to: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard" },
          { to: "/app/clients", icon: Users, label: "Clients" },
          { to: "/app/team", icon: UserCog, label: "Team" },
          { to: "/app/tasks", icon: KanbanSquare, label: "Tasks" },
          { to: "/app/calendar", icon: CalendarDays, label: "Calendar" },
          { to: "/app/notifications", icon: Bell, label: "Notifications" },
        ].map((link) => (
          <NavLink 
            key={link.to} 
            to={link.to} 
            className={linkClass}
            onClick={() => onClose?.()}
          >
            <link.icon className="h-4 w-4 shrink-0" />
            {link.label}
          </NavLink>
        ))}
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
