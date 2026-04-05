import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function useNotifications() {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!user) return

    // 1. Request Permission for Mobile/Browser Push
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }

    // 2. Listen to Database Notifications using Supabase Realtime
    const channel = supabase
      .channel('realtime_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const { title, body } = payload.new

          // 3. Trigger Local Mobile/Browser Notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
              body: body,
              icon: '/icon-192x192.png', // Ensure this exists in public folder
              badge: '/icon-192x192.png',
              tag: 'task-assignment',
            })
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user])
}
