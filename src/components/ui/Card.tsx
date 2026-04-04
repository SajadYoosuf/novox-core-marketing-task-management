import clsx from 'clsx'
import type { ReactNode } from 'react'

export function Card({
  className,
  children,
  padding = true,
}: {
  className?: string
  children: ReactNode
  padding?: boolean
}) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm',
        padding && 'p-4',
        className,
      )}
    >
      {children}
    </div>
  )
}
