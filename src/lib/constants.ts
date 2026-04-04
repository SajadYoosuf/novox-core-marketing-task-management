import type { PlatformType, TaskStatus, UserRole } from '@/types/db'
import { Globe, Camera, Share2, Briefcase, MapPin, MessageCircle, AtSign } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const PLATFORM_ICON: Record<PlatformType, LucideIcon> = {
  instagram: Camera,
  facebook: Share2,
  linkedin: Briefcase,
  gmb: MapPin,
  website: Globe,
  whatsapp: MessageCircle,
  threads: AtSign,
}

export const PLATFORM_LABEL: Record<PlatformType, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  gmb: 'Google My Business',
  website: 'Website',
  whatsapp: 'WhatsApp',
  threads: 'Threads',
}

export const TASK_CONTENT_TYPES = [
  'static',
  'video',
  'reel',
  'carousel',
  'story',
  'website_seo',
  'blog',
  'gallery',
  'content_checking',
] as const
export type TaskContentType = (typeof TASK_CONTENT_TYPES)[number]

export const TASK_CONTENT_TYPE_LABELS: Record<TaskContentType, string> = {
  static: 'Static Post',
  video: 'Video',
  reel: 'Instagram Reel',
  carousel: 'Carousel',
  story: 'Story',
  website_seo: 'Website SEO',
  blog: 'Blog Post',
  gallery: 'Image Gallery',
  content_checking: 'Content Checking',
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  review: 'Review',
  approved: 'Approved',
  completed: 'Completed',
  rejected: 'Rejected',
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

export const ROLE_LABELS: Record<UserRole, string> = {
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
