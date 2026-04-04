-- Modernize subtasks to include platform mapping and individual assignees
-- Run via: supabase db push

ALTER TABLE public.subtasks 
ADD COLUMN IF NOT EXISTS client_platform_id uuid REFERENCES public.client_platforms(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_subtasks_platform ON public.subtasks (client_platform_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_assignee ON public.subtasks (assigned_user_id);
