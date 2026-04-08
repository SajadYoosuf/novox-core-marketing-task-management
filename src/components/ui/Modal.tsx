import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  noHeaderStyles,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  wide?: boolean
  noHeaderStyles?: boolean
}) {
  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close overlay"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-[101] max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-white/5 bg-[#0B0D13]/60 backdrop-blur-2xl shadow-2xl sm:max-h-[90vh] sm:rounded-3xl ${
          wide ? 'sm:max-w-4xl p-0' : 'sm:max-w-lg p-6'
        }`}
      >
        {!noHeaderStyles && (
          <div className="mb-6 flex items-start justify-between gap-4">
            <h2 id="modal-title" className="text-lg font-bold text-[var(--color-text)]">
              {title}
            </h2>
            <button 
              type="button" 
              className="p-2 -mr-2 rounded-xl text-[var(--color-text-muted)] hover:bg-white/5 transition-all cursor-pointer" 
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {noHeaderStyles && (
           <button 
           type="button" 
           className="absolute top-8 right-8 z-[110] p-3 rounded-2xl bg-white/5 border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer" 
           onClick={onClose}
         >
           <X className="h-5 w-5" />
         </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
