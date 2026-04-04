import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', dark)
}

export const useThemeStore = create(
  persist<{
    theme: Theme
    setTheme: (t: Theme) => void
    initTheme: () => void
  }>(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
      initTheme: () => {
        applyTheme(get().theme)
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
          if (get().theme === 'system') applyTheme('system')
        })
      },
    }),
    { name: 'mw-theme' },
  ),
)
