import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar, Clock, X } from 'lucide-react'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

interface DatePickerProps {
  value: string  // ISO datetime string or ''
  onChange: (val: string) => void
  label?: string
}

export function DatePicker({ value, onChange, label }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Parse existing value
  const parsed = value ? new Date(value) : null
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? new Date().getMonth())
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? new Date().getFullYear())
  const [selectedDate, setSelectedDate] = useState<Date | null>(parsed)
  const [hours, setHours] = useState(parsed ? String(parsed.getHours()).padStart(2, '0') : '09')
  const [minutes, setMinutes] = useState(parsed ? String(parsed.getMinutes()).padStart(2, '0') : '00')

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Sync when value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value)
      setSelectedDate(d)
      setViewMonth(d.getMonth())
      setViewYear(d.getFullYear())
      setHours(String(d.getHours()).padStart(2, '0'))
      setMinutes(String(d.getMinutes()).padStart(2, '0'))
    }
  }, [value])

  function getDaysInMonth(month: number, year: number) {
    return new Date(year, month + 1, 0).getDate()
  }

  function getFirstDayOfMonth(month: number, year: number) {
    return new Date(year, month, 1).getDay()
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(y => y - 1)
    } else {
      setViewMonth(m => m - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(y => y + 1)
    } else {
      setViewMonth(m => m + 1)
    }
  }

  function selectDay(day: number) {
    const d = new Date(viewYear, viewMonth, day, parseInt(hours), parseInt(minutes))
    setSelectedDate(d)
    emitValue(d)
  }

  function emitValue(d: Date) {
    // Format as "YYYY-MM-DDTHH:mm" for datetime-local compatibility
    const yr = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const dy = String(d.getDate()).padStart(2, '0')
    const hr = String(d.getHours()).padStart(2, '0')
    const mn = String(d.getMinutes()).padStart(2, '0')
    onChange(`${yr}-${mo}-${dy}T${hr}:${mn}`)
  }

  function handleTimeChange(h: string, m: string) {
    setHours(h)
    setMinutes(m)
    if (selectedDate) {
      const d = new Date(selectedDate)
      d.setHours(parseInt(h), parseInt(m))
      setSelectedDate(d)
      emitValue(d)
    }
  }

  function clearDate() {
    setSelectedDate(null)
    onChange('')
    setOpen(false)
  }

  const daysInMonth = getDaysInMonth(viewMonth, viewYear)
  const firstDay = getFirstDayOfMonth(viewMonth, viewYear)
  const today = new Date()

  // Build calendar grid
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const displayValue = selectedDate
    ? `${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${hours}:${minutes}`
    : ''

  return (
    <div className="space-y-2" ref={ref}>
      {label && (
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4F5B76]">{label}</label>
      )}
      
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 h-12 rounded-xl bg-black/40 border border-[#1E2330] px-4 text-left hover:border-[var(--color-accent)]/40 focus:border-[var(--color-accent)]/40 transition-all cursor-pointer group"
      >
        <Calendar className="h-4 w-4 text-[var(--color-accent)] opacity-40 group-hover:opacity-80 transition-opacity" />
        {displayValue ? (
          <span className="text-xs font-bold text-[var(--color-text)] flex-1">{displayValue}</span>
        ) : (
          <span className="text-xs font-medium text-white/20 flex-1">Pick a date...</span>
        )}
        {displayValue && (
          <span
            onClick={(e) => { e.stopPropagation(); clearDate() }}
            className="text-white/20 hover:text-red-400 transition-colors p-1"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {/* Calendar Dropdown */}
      {open && (
        <div className="fixed z-[9999] w-[320px] rounded-2xl border border-white/10 bg-[#0F1219] shadow-2xl shadow-black/60 p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            top: ref.current ? ref.current.getBoundingClientRect().bottom + 8 : 0,
            left: ref.current ? Math.min(ref.current.getBoundingClientRect().left, window.innerWidth - 340) : 0,
          }}
        >
          {/* Month/Year Nav */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold text-[var(--color-text)]">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map(d => (
              <div key={d} className="flex h-8 items-center justify-center text-[10px] font-black uppercase tracking-wider text-white/25">
                {d}
              </div>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />
              
              const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
              const isSelected = selectedDate && day === selectedDate.getDate() && viewMonth === selectedDate.getMonth() && viewYear === selectedDate.getFullYear()
              const isPast = new Date(viewYear, viewMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate())

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`
                    flex h-9 w-full items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer
                    ${isSelected
                      ? 'bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/30'
                      : isToday
                        ? 'bg-white/10 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30'
                        : isPast
                          ? 'text-white/15 hover:bg-white/5 hover:text-white/30'
                          : 'text-white/60 hover:bg-white/10 hover:text-white'
                    }
                  `}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Time Picker */}
          <div className="flex items-center gap-3 pt-2 border-t border-white/5">
            <Clock className="h-4 w-4 text-[var(--color-accent)] opacity-40" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Time</span>
            <div className="flex items-center gap-1 ml-auto">
              <select
                value={hours}
                onChange={(e) => handleTimeChange(e.target.value, minutes)}
                className="h-8 w-14 rounded-lg bg-white/5 border border-white/10 text-center text-xs font-bold text-[var(--color-text)] cursor-pointer focus:border-[var(--color-accent)]/40 outline-none transition-all appearance-none"
              >
                {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                  <option key={h} value={h} className="bg-[#0F1219]">{h}</option>
                ))}
              </select>
              <span className="text-sm font-bold text-white/30">:</span>
              <select
                value={minutes}
                onChange={(e) => handleTimeChange(hours, e.target.value)}
                className="h-8 w-14 rounded-lg bg-white/5 border border-white/10 text-center text-xs font-bold text-[var(--color-text)] cursor-pointer focus:border-[var(--color-accent)]/40 outline-none transition-all appearance-none"
              >
                {['00', '15', '30', '45'].map(m => (
                  <option key={m} value={m} className="bg-[#0F1219]">{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                const t = new Date()
                setViewMonth(t.getMonth())
                setViewYear(t.getFullYear())
                selectDay(t.getDate())
              }}
              className="flex-1 h-8 rounded-lg bg-white/5 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:bg-white/10 hover:text-white/60 transition-all cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const t = new Date()
                t.setDate(t.getDate() + 1)
                setViewMonth(t.getMonth())
                setViewYear(t.getFullYear())
                selectDay(t.getDate())
              }}
              className="flex-1 h-8 rounded-lg bg-white/5 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:bg-white/10 hover:text-white/60 transition-all cursor-pointer"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => {
                const t = new Date()
                t.setDate(t.getDate() + 7)
                setViewMonth(t.getMonth())
                setViewYear(t.getFullYear())
                selectDay(t.getDate())
              }}
              className="flex-1 h-8 rounded-lg bg-white/5 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:bg-white/10 hover:text-white/60 transition-all cursor-pointer"
            >
              Next Week
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
