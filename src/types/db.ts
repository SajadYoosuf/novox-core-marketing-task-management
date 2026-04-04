export type UserRole = 'admin' | 'marketing_head' | 'designer_head' | 'designer' | 'marketing_executive'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'review'
  | 'approved'
  | 'scheduled'
  | 'posted'
  | 'completed'
  | 'rejected'
export type PlatformType = 'instagram' | 'facebook' | 'linkedin' | 'gmb' | 'website' | 'whatsapp' | 'threads'
export type SubmissionKind = 'link' | 'file'
export type PerformanceEvent =
  | 'task_assigned'
  | 'task_completed'
  | 'task_delayed'
  | 'task_rejected'
  | 'platform_status_changed'
  | 'submission_added'

export interface Profile {
  id: string
  email: string | null
  full_name: string
  role: UserRole
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  name: string
  industry: string
  contact_email: string | null
  contact_phone: string | null
  contact_notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ClientPlatform {
  id: string
  client_id: string
  platform: PlatformType
  account_handle: string | null
  account_link: string | null
  is_active: boolean
}

export interface TaskRow {
  id: string
  client_id: string
  title: string
  description: string | null
  priority: TaskPriority
  deadline: string | null
  publish_date: string | null
  status: TaskStatus
  content_type: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  clients?: Client | null
}

export interface TaskAssignee {
  task_id: string
  user_id: string
  profiles?: Profile | null
}

export interface TaskPlatformRow {
  id: string
  task_id: string
  client_platform_id: string
  assigned_user_id: string | null
  status: TaskStatus
  submission_required: boolean
  client_platforms?: ClientPlatform | null
  assignee?: Profile | null
}

export interface Subtask {
  id: string
  task_id: string
  title: string
  is_done: boolean
  sort_order: number
  client_platform_id: string | null
  assigned_user_id: string | null
  client_platforms?: ClientPlatform | null
  profiles?: Profile | null
}

export interface Submission {
  id: string
  task_platform_id: string
  kind: SubmissionKind
  url: string | null
  storage_path: string | null
  file_name: string | null
  created_by: string | null
  created_at: string
}

export interface Comment {
  id: string
  task_id: string | null
  task_platform_id: string | null
  body: string
  is_rejection: boolean
  created_by: string | null
  created_at: string
  profiles?: Profile | null
}

export interface NotificationRow {
  id: string
  user_id: string
  title: string
  body: string | null
  type: string
  read: boolean
  related_task_id: string | null
  created_at: string
}

export interface TaskWithRelations extends TaskRow {
  clients?: Client | null
  task_assignees?: TaskAssignee[]
  task_platforms?: TaskPlatformRow[]
  subtasks?: Subtask[]
}
