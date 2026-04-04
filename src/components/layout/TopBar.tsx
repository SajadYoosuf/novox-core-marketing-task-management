import { Search, Moon, Sun, Monitor, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'

export function TopBar({ search, onSearchChange }: { search: string; onSearchChange: (v: string) => void }) {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const signOut = useAuthStore((s) => s.signOut)
  const navigate = useNavigate()

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 sm:h-14 sm:flex-nowrap sm:gap-4 sm:px-4 sm:py-0">
      <div className="relative min-w-0 flex-1 basis-full sm:basis-auto sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search tasks, clients…"
          className="pl-9"
        />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button
          variant={theme === 'light' ? 'secondary' : 'ghost'}
          className="!px-2"
          onClick={() => setTheme('light')}
          aria-label="Light mode"
        >
          <Sun className="h-4 w-4" />
        </Button>
        <Button
          variant={theme === 'dark' ? 'secondary' : 'ghost'}
          className="!px-2"
          onClick={() => setTheme('dark')}
          aria-label="Dark mode"
        >
          <Moon className="h-4 w-4" />
        </Button>
        <Button
          variant={theme === 'system' ? 'secondary' : 'ghost'}
          className="!px-2"
          onClick={() => setTheme('system')}
          aria-label="System theme"
        >
          <Monitor className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          className="!px-2"
          onClick={async () => {
            await signOut()
            navigate('/login', { replace: true })
          }}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
