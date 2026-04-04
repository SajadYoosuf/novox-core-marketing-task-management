import clsx from 'clsx'
import type { ReactNode } from 'react'

export function Card({
  className,
  children,
  padding = true,
  onClick,
}: {
  className?: string
  children: ReactNode
  padding?: boolean
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm',
        padding && 'p-4',
        onClick && 'cursor-pointer active:scale-[0.98] transition-transform',
        className,
      )}
    >
      {children}
    </div>
  )
}
