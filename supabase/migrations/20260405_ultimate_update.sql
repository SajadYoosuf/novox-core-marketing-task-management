-- =========================================================
-- ULTIMATE TASK SCHEMA UPDATE (2026-04-05)
-- Purpose: Sync Subtask Table + Individual Notifications
-- =========================================================

-- 1. ENHANCE SUBTASKS TABLE
-- Add missing columns to support assignments and Kanban statuses
ALTER TABLE public.subtasks 
ADD COLUMN IF NOT EXISTS status public.task_status NOT NULL DEFAULT 'pending';

ALTER TABLE public.subtasks 
ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.subtasks 
ADD COLUMN IF NOT EXISTS client_platform_id uuid REFERENCES public.client_platforms (id) ON DELETE SET NULL;

-- Migrate existing completion values to the new status enum
UPDATE public.subtasks SET status = 'completed' WHERE is_done = true;
UPDATE public.subtasks SET status = 'in_progress' WHERE is_done = false AND task_id IN (SELECT id FROM public.tasks WHERE status = 'in_progress');

-- 2. CREATE NOTIFICATION TRIGGERS FOR ALL ASSIGNMENTS
-- This ensures users get entries in the 'notifications' table which 
-- can be used for Mobile Push notifications via PWA or Edge Functions.

-- Trigger for Creative Subtasks
CREATE OR REPLACE FUNCTION public.notify_subtask_assigned()
RETURNS trigger AS $$
DECLARE
  t_title text;
BEGIN
  IF NEW.assigned_user_id IS NOT NULL THEN
    SELECT title INTO t_title FROM public.tasks WHERE id = NEW.task_id;
    INSERT INTO public.notifications (user_id, title, body, type, related_task_id)
    VALUES (
      NEW.assigned_user_id,
      'New Technical Unit Assigned',
      'You were assigned to: ' || NEW.title || ' in ' || t_title,
      'subtask_assigned',
      NEW.task_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_subtask_assign_notify ON public.subtasks;
CREATE TRIGGER trg_subtask_assign_notify
  AFTER INSERT OR UPDATE OF assigned_user_id ON public.subtasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_subtask_assigned();

-- Trigger for Marketing Platform Assignments
CREATE OR REPLACE FUNCTION public.notify_platform_assigned()
RETURNS trigger AS $$
DECLARE
  t_title text;
  p_name text;
BEGIN
  IF NEW.assigned_user_id IS NOT NULL THEN
    SELECT title INTO t_title FROM public.tasks WHERE id = NEW.task_id;
    SELECT platform INTO p_name FROM public.client_platforms WHERE id = NEW.client_platform_id;
    INSERT INTO public.notifications (user_id, title, body, type, related_task_id)
    VALUES (
      NEW.assigned_user_id,
      'New Posting Assignment',
      'You need to post ' || t_title || ' on ' || UPPER(p_name),
      'platform_assigned',
      NEW.task_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_platform_assign_notify ON public.task_platforms;
CREATE TRIGGER trg_platform_assign_notify
  AFTER INSERT OR UPDATE OF assigned_user_id ON public.task_platforms
  FOR EACH ROW EXECUTE FUNCTION public.notify_platform_assigned();

-- 3. ENSURE RLS POLICIES ARE UPDATED
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS st_select ON public.subtasks;
CREATE POLICY st_select ON public.subtasks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS st_write ON public.subtasks;
CREATE POLICY st_write ON public.subtasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
