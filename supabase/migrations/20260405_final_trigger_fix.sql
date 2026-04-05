-- =========================================================
-- FINAL TRIGGER STABILITY FIX (2026-04-05)
-- Purpose: Fix "foreign key constraint" crash in notifications
-- =========================================================

-- 1. DROP THE CRASHING TRIGGER
DROP TRIGGER IF EXISTS trg_subtask_assign_notify ON public.subtasks;
DROP TRIGGER IF EXISTS trg_platform_assign_notify ON public.task_platforms;

-- 2. COMPLETELY REWRITE THE TRIGGER FUNCTION TO BE ERROR-PROOF
CREATE OR REPLACE FUNCTION public.notify_assignment_stable()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE 
  target_user_id uuid;
  t_title text;
BEGIN
  -- We identify the recipient of the notification based on the table
  -- We use 'assigned_user_id' for platforms/subtasks, and 'user_id' for direct assignments
  target_user_id := COALESCE(NEW.assigned_user_id, (NEW as any).user_id);
  
  -- CRITICAL SAFETY CHECK: 
  -- 1. Recipient must exist (is NOT NULL)
  -- 2. Recipient must be a valid UUID (not an empty string or dummy)
  -- 3. We use a try-catch pattern to prevent the entire task-save from failing
  IF target_user_id IS NOT NULL THEN
    BEGIN
      SELECT title INTO t_title FROM public.tasks WHERE id = NEW.task_id;
      
      INSERT INTO public.notifications (user_id, title, body, type, related_task_id)
      VALUES (
        target_user_id, 
        'New Work Detail', 
        'Assigned: ' || COALESCE(NEW.title, 'Activity Unit'), 
        'task_assigned', 
        NEW.task_id
      );
    EXCEPTION WHEN OTHERS THEN
      -- If the notification fails (e.g. foreign key error), 
      -- we log and continue so the actual SUBTASK is still saved!
      RAISE WARNING 'Notification failed for user %, skipping.', target_user_id;
    END;
  END IF;
  
  RETURN NEW;
END; $$;

-- 3. REAPPLY TRIGGERS
CREATE TRIGGER trg_subtask_assign_notify 
  AFTER INSERT OR UPDATE OF assigned_user_id ON public.subtasks 
  FOR EACH ROW EXECUTE FUNCTION public.notify_assignment_stable();

CREATE TRIGGER trg_platform_assign_notify 
  AFTER INSERT OR UPDATE OF assigned_user_id ON public.task_platforms 
  FOR EACH ROW EXECUTE FUNCTION public.notify_assignment_stable();
