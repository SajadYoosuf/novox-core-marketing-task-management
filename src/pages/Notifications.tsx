import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { NotificationRow } from '@/types/db'
import { format } from 'date-fns'

export function Notifications() {
  const userId = useAuthStore((s) => s.user?.id)
  const [items, setItems] = useState<NotificationRow[]>([])

  const load = useCallback(async () => {
    if (!supabaseConfigured || !userId) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
    setItems((data as NotificationRow[]) ?? [])
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  useRealtimeNotifications(load)

  async function markRead(id: string) {
    if (!supabaseConfigured) return
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    await load()
  }

  async function markAll() {
    if (!supabaseConfigured || !userId) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
    await load()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Notifications</h1>
        <Button variant="secondary" type="button" onClick={() => void markAll()}>
          Mark all read
        </Button>
      </div>
      <p className="text-sm text-[var(--color-text-muted)]">Realtime updates when new rows arrive (Supabase Realtime).</p>
      <div className="space-y-2">
        {items.map((n) => (
          <Card
            key={n.id}
            className={!n.read ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5' : ''}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-[var(--color-text)]">{n.title}</p>
                {n.body ? <p className="text-sm text-[var(--color-text-muted)]">{n.body}</p> : null}
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{format(new Date(n.created_at), 'PPp')}</p>
                {n.related_task_id ? (
                  <Link className="mt-2 inline-block text-sm text-[var(--color-accent)]" to={`/app/tasks/${n.related_task_id}`}>
                    Open task
                  </Link>
                ) : null}
              </div>
              {!n.read ? (
                <Button variant="ghost" className="shrink-0 !px-2 text-xs" type="button" onClick={() => void markRead(n.id)}>
                  Mark read
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
        {!items.length ? <p className="text-sm text-[var(--color-text-muted)]">No notifications yet.</p> : null}
      </div>
    </div>
  )
}
