-- =========================================================
-- NOTIFICATION RLS FIX (2026-04-05)
-- Purpose: Fix "new row violates row-level security policy" error
-- =========================================================

-- 1. GIVE PERMISSION TO INSERT NOTIFICATIONS
-- This is required so that the triggers can alert team members when a task is assigned.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS n_insert ON public.notifications;
CREATE POLICY n_insert ON public.notifications 
FOR INSERT TO authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS n_select ON public.notifications;
CREATE POLICY n_select ON public.notifications 
FOR SELECT TO authenticated 
USING (auth.uid() = user_id);

-- 2. ENSURE TRIGGER FUNCTION IS "SECURITY DEFINER"
-- This allows the trigger to work regardless of the manager's individual permissions.
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER -- CRITICAL: This bypasses RLS for the notification itself
SET search_path = public
AS $$
DECLARE t_title text;
BEGIN
  SELECT title INTO t_title FROM public.tasks WHERE id = NEW.task_id;
  
  -- Create the notification for the assigned user
  INSERT INTO public.notifications (user_id, title, body, type, related_task_id)
  VALUES (
    COALESCE(NEW.assigned_user_id, (SELECT user_id FROM public.task_assignees WHERE task_id = NEW.task_id LIMIT 1)), 
    'Work Assigned', 
    'Assigned Unit: ' || COALESCE(NEW.title, 'Task Assignment'), 
    'task_assigned', 
    NEW.task_id
  );
  
  RETURN NEW;
END; $$;
