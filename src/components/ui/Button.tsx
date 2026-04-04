import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

const variants = {
  primary:
    'bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-violet-600 dark:hover:bg-violet-500 shadow-sm',
  secondary:
    'bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)] hover:opacity-90',
  ghost:
    'text-[var(--color-text)] hover:bg-[var(--color-surface-2)] dark:text-[var(--color-text-muted)] dark:hover:text-[var(--color-text)]',
  danger: 'bg-red-600 text-white hover:bg-red-700',
}

export function Button({
  className,
  variant = 'primary',
  children,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
  children?: ReactNode
}) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 disabled:pointer-events-none',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
