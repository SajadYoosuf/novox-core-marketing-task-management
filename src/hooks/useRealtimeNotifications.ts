import { useEffect } from 'react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function useRealtimeNotifications(onNew?: () => void) {
  const userId = useAuthStore((s) => s.user?.id)

  useEffect(() => {
    if (!supabaseConfigured || !userId) return

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          onNew?.()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, onNew])
}
