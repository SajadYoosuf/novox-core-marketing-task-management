import type { TaskStatus } from '@/types/db'

export function nextPlatformStatus(current: TaskStatus): TaskStatus | null {
  const flow: TaskStatus[] = [
    'pending',
    'in_progress',
    'review',
    'approved',
    'scheduled',
    'posted',
    'completed',
  ]
  const i = flow.indexOf(current)
  if (i < 0 || i >= flow.length - 1) return null
  return flow[i + 1]!
}

export function previousPlatformStatus(current: TaskStatus): TaskStatus | null {
  const flow: TaskStatus[] = [
    'pending',
    'in_progress',
    'review',
    'approved',
    'scheduled',
    'posted',
    'completed',
  ]
  const i = flow.indexOf(current)
  if (i <= 0) return null
  return flow[i - 1]!
}

/** Overall task status uses same ordering for Kanban columns - limited to Active statuses per user request */
export const KANBAN_COLUMNS: TaskStatus[] = [
  'pending',
  'in_progress',
  'review',
  'approved',
  'scheduled',
  'posted',
]

