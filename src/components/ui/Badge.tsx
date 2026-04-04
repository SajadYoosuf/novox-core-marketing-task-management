import clsx from 'clsx'
import type { ComponentType } from 'react'
import type { TaskStatus } from '@/types/db'
import { STATUS_COLORS, STATUS_LABEL } from '@/lib/constants'

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        STATUS_COLORS[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

export function PlatformBadge({
  label,
  icon: Icon,
}: {
  label: string
  icon?: ComponentType<{ className?: string }>
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--color-text)]">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </span>
  )
}
