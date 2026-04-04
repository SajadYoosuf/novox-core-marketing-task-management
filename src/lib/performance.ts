import { supabase, supabaseConfigured } from '@/lib/supabase'
import type { PerformanceEvent } from '@/types/db'

export async function logPerformance(
  userId: string,
  event: PerformanceEvent,
  taskId?: string | null,
  taskPlatformId?: string | null,
  meta?: Record<string, unknown>,
) {
  if (!supabaseConfigured) return
  await supabase.from('performance_logs').insert({
    user_id: userId,
    event,
    task_id: taskId ?? null,
    task_platform_id: taskPlatformId ?? null,
    meta: meta ?? {},
  })
}

export async function insertNotification(
  userId: string,
  title: string,
  body: string,
  type: string,
  relatedTaskId?: string | null,
) {
  if (!supabaseConfigured) return
  await supabase.from('notifications').insert({
    user_id: userId,
    title,
    body,
    type,
    related_task_id: relatedTaskId ?? null,
  })
}
