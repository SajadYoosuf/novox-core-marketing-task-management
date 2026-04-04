import type { TaskStatus } from '@/types/db'

export function canPlatformMoveToReview(
  submissionRequired: boolean,
  submissionsCount: number,
): boolean {
  if (!submissionRequired) return true
  return submissionsCount > 0
}

export function nextPlatformStatus(current: TaskStatus): TaskStatus | null {
  const flow: TaskStatus[] = [
    'pending',
    'assigned',
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
    'assigned',
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
  'assigned',
  'in_progress',
  'review',
  'approved',
  'scheduled',
  'posted',
]
