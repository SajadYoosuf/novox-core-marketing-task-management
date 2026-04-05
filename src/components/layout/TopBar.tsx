import { useState, useRef, useEffect } from 'react'
import { Bell, Moon, Sun, LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'

export function TopBar(_props: { search?: string; onSearchChange?: (v: string) => void }) {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const profile = useAuthStore((s) => s.profile)
  const signOut = useAuthStore((s) => s.signOut)
  const navigate = useNavigate()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSignOut() {
    setMenuOpen(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="relative flex h-[70px] shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 backdrop-blur-xl z-50">
      {/* Left Search Space */}
      <div className="flex-1 max-w-md" />

      {/* Action Center */}
      <div className="flex items-center gap-6">
        {/* Theme & Notifications */}
        <div className="flex items-center gap-2 rounded-xl bg-[var(--color-surface-2)]/50 p-1 border border-white/5">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text)] transition-all cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="h-4 w-px bg-[var(--color-border)] mx-1" />
          <button 
            onClick={() => navigate('/app/notifications')}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text)] transition-all cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
          </button>
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-4 border-l border-[var(--color-border)] pl-6">
          <div className="flex flex-col items-end">
            <span className="text-sm font-bold text-[var(--color-text)] leading-tight">
              {profile?.full_name || 'Team Member'}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] opacity-60">
              {profile?.role?.replace('_', ' ') || 'Executive'}
            </span>
          </div>

          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px] transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/20 cursor-pointer"
            >
               <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-900 overflow-hidden">
                 {profile?.avatar_url ? (
                   <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                 ) : (
                   <User className="h-5 w-5 text-white/80" />
                 )}
               </div>
            </button>
            
            {/* Dropdown Menu - positioned fixed to avoid overflow clipping */}
            {menuOpen && (
              <div 
                className="fixed w-48 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-2xl z-[9999] animate-in fade-in slide-in-from-top-2 duration-200"
                style={{
                  top: '65px',
                  right: '16px',
                }}
              >
                 <button 
                   onClick={() => void handleSignOut()}
                   className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                 >
                   <LogOut className="h-4 w-4" />
                   Sign Out
                 </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
