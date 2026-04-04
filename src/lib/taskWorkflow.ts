import type { TaskStatus } from '@/types/db'
import { STATUS_ORDER } from '@/lib/constants'

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
    'completed',
  ]
  const i = flow.indexOf(current)
  if (i <= 0) return null
  return flow[i - 1]!
}

/** Overall task status uses same ordering for Kanban columns */
export const KANBAN_COLUMNS: TaskStatus[] = [
  ...STATUS_ORDER,
  'rejected',
]
