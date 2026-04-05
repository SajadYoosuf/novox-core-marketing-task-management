import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

interface Option {
  id: string
  name: string
}

interface CustomDropdownProps {
  options: Option[]
  value: string
  onChange: (val: string) => void
  placeholder: string
  icon?: React.ReactNode
  className?: string
}

export function CustomDropdown({ options, value, onChange, placeholder, icon, className = '' }: CustomDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.id === value)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-11 w-44 items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] pl-4 pr-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-text)] hover:bg-[#161B26] hover:border-white/10 transition-all cursor-pointer group focus:outline-none focus:ring-4 ring-indigo-500/10"
      >
        {icon && <span className="text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors">{icon}</span>}
        <span className={`truncate flex-1 text-left ${!selected ? 'text-[var(--color-text-muted)] opacity-50' : 'text-[var(--color-text)]'}`}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown className={`h-3 w-3 text-[var(--color-text-muted)] opacity-40 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-[200] w-48 overflow-hidden rounded-2xl border border-white/10 bg-[#0F1219] p-2 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-64 overflow-y-auto scrollbar-hide">
            {/* Search option could go here if needed later */}
            <button
              type="button"
              className={`flex w-full items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer text-left
                ${!value 
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' 
                  : 'text-white/50 hover:bg-white/5 hover:text-white'
                }`}
              onClick={() => { onChange(''); setOpen(false); }}
            >
              {placeholder}
              {!value && <Check className="h-3 w-3" />}
            </button>
            
            <div className="my-1 h-px bg-white/5" />
            
            {options.map(option => (
              <button
                key={option.id}
                type="button"
                className={`flex w-full items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer text-left
                  ${value === option.id 
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' 
                    : 'text-white/50 hover:bg-white/5 hover:text-white'
                  }`}
                onClick={() => { onChange(option.id); setOpen(false); }}
              >
                <span className="truncate pr-2">{option.name}</span>
                {value === option.id && <Check className="h-3 w-3" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
