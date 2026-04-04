import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import clsx from 'clsx'

interface Option {
  id: string
  name: string
}

interface SelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  required?: boolean
  className?: string
}

export function Select({ options, value, onChange, placeholder = 'Select an option', label, required, className }: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selectedOption = options.find(o => o.id === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={clsx('relative w-full', className)} ref={ref}>
      {label && (
        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.1em] text-[var(--color-text-muted)] opacity-60">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={clsx(
          'flex h-12 w-full items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 px-4 text-sm font-bold text-[var(--color-text)] transition-all cursor-pointer focus:bg-[var(--color-surface)] focus:ring-4 focus:ring-[var(--color-accent)]/20',
          !selectedOption && 'text-[var(--color-text-muted)]'
        )}
      >
        <span className="truncate">{selectedOption ? selectedOption.name : placeholder}</span>
        <ChevronDown className={clsx('h-4 w-4 transition-transform duration-300', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-[110] mt-2 max-h-60 w-full overflow-y-auto rounded-2xl border border-white/10 bg-[var(--color-surface)] p-2 shadow-2xl backdrop-blur-3xl animate-in fade-in slide-in-from-top-2">
          {options.length === 0 && (
            <div className="px-3 py-2 text-xs italic text-[var(--color-text-muted)]">No options available</div>
          )}
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={clsx(
                'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-all cursor-pointer hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)]',
                value === option.id ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'text-[var(--color-text)]'
              )}
              onClick={() => {
                onChange(option.id)
                setOpen(false)
              }}
            >
              {option.name}
              {value === option.id && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
