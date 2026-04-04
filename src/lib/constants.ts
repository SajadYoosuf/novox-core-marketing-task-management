import type { TaskStatus, UserRole } from '@/types/db'
import { Globe, Camera, Share2, Briefcase, MapPin, MessageCircle, AtSign } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const PLATFORM_ICON: Record<string, LucideIcon> = {
  instagram: Camera,
  facebook: Share2,
  linkedin: Briefcase,
  gmb: MapPin,
  website: Globe,
  whatsapp: MessageCircle,
  threads: AtSign,
  tiktok: Share2,
  pinterest: Share2,
  youtube: Share2,
  x: Share2,
}

export const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  gmb: 'Google My Business',
  website: 'Website',
  whatsapp: 'WhatsApp',
  threads: 'Threads',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  youtube: 'YouTube',
  x: 'X (Twitter)',
}

export const TASK_CONTENT_TYPES = [
  'post',
  'reel',
  'carousel',
  'story',
  'qna',
  'website_seo',
  'gallery_images',
  'website_blog',
  'website_content',
] as const
export type TaskContentType = (typeof TASK_CONTENT_TYPES)[number]

export const TASK_CONTENT_TYPE_LABELS: Record<TaskContentType, string> = {
  post: 'Post',
  reel: 'Reel',
  carousel: 'Carousel',
  story: 'Story',
  qna: 'Q&A',
  website_seo: 'Website SEO',
  gallery_images: 'Gallery Images',
  website_blog: 'Website Blog',
  website_content: 'Website Content',
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  review: 'Review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  posted: 'Posted',
  completed: 'Completed',
  rejected: 'Rejected',
}

export const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  assigned: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  in_progress: 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800',
  review: 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
  approved: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  scheduled: 'bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800',
  posted: 'bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700',
  rejected: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
}

export const PRIORITY_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const STATUS_ORDER: TaskStatus[] = [
  'pending',
  'assigned',
  'in_progress',
  'review',
  'approved',
  'scheduled',
  'posted',
  'completed',
  'rejected',
]

export const ALL_USER_ROLES: UserRole[] = [
  'admin',
  'marketing_head',
  'designer_head',
  'designer',
  'marketing_executive',
]

/**
 * Roles that a Marketing Head can assign to new members
 */
export const HEAD_ASSIGNABLE_ROLES: UserRole[] = ['marketing_executive', 'designer']

/**
 * Roles that a Designer Head can assign to new members
 */
export const DESIGNER_HEAD_ASSIGNABLE_ROLES: UserRole[] = ['designer']

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  marketing_head: 'Marketing Head',
  designer_head: 'Designer Head',
  designer: 'Designer',
  marketing_executive: 'Marketing Executive',
}

/**
 * Higher number = more authority
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  marketing_head: 80,
  designer_head: 70,
  designer: 40,
  marketing_executive: 30,
}

export function canAssignRole(myRole: UserRole, targetRole: UserRole): boolean {
  return ROLE_HIERARCHY[myRole] >= ROLE_HIERARCHY[targetRole]
}

export function canEditProfileRole(myRole: UserRole, profileRole: UserRole): boolean {
  // Can only edit roles of people equal or below you
  // But usually, only admin/heads can edit anyone.
  if (ROLE_HIERARCHY[myRole] < 70) return false
  return ROLE_HIERARCHY[myRole] >= ROLE_HIERARCHY[profileRole]
}

export function isElevated(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= 70
}

export function canManageClients(role: UserRole): boolean {
  return isElevated(role)
}

export function performanceScore(completed: number, delayed: number, rejected: number): number {
  return completed * 2 - delayed - rejected * 2
}
