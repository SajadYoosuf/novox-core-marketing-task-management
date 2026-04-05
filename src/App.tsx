import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { AppShell } from '@/components/layout/AppShell'
import { Setup } from '@/pages/Setup'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { Clients } from '@/pages/Clients'
import { ClientDetail } from '@/pages/ClientDetail'
import { TasksKanban } from '@/pages/TasksKanban'
import { Calendar } from '@/pages/Calendar'
import { TaskDetail } from '@/pages/TaskDetail'
import { Notifications } from '@/pages/Notifications'
import { Team } from '@/pages/Team'

function Protected({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-[var(--color-text-muted)]">Loading…</div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

import { useNotifications } from '@/hooks/useNotifications'
 
export default function App() {
  const initAuth = useAuthStore((s) => s.init)
  const initTheme = useThemeStore((s) => s.initTheme)
  const setSession = useAuthStore((s) => s.setSession)
  
  // Initialize Global Mobile/Browser Notifications
  useNotifications()

  useEffect(() => {
    initTheme()
    initAuth()
  }, [initTheme, initAuth])

  useEffect(() => {
    let cancelled = false
    const setLoading = (loading: boolean) => useAuthStore.setState({ loading })

    if (!supabaseConfigured) {
      setLoading(false)
      return
    }

    // Still sync with Supabase Auth for back-end compatibility
    setLoading(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session) setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setSession(session)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [setSession])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={supabaseConfigured ? <Navigate to="/login" replace /> : <Setup />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/app"
          element={
            <Protected>
              <AppShell />
            </Protected>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="team" element={<Team />} />
          <Route path="tasks" element={<TasksKanban />} />
          <Route path="tasks/:id" element={<TaskDetail />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
