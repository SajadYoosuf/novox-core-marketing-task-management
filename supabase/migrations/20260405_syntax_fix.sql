-- =========================================================
-- SYNTAX-CORRECT REPAIR SCRIPT (2026-04-05)
-- Purpose: Fix PostgreSQL syntax error in trigger functions
-- =========================================================

-- 1. DROP BREAKING TRIGGERS
DROP TRIGGER IF EXISTS trg_subtask_assign_notify ON public.subtasks;
DROP TRIGGER IF EXISTS trg_platform_assign_notify ON public.task_platforms;

-- 2. CREATE A STABLE TRIGGER FUNCTION (SYNTAX CORRECT)
-- This function is designed to handle assignments for both Subtasks and Platforms
CREATE OR REPLACE FUNCTION public.notify_assignment_safe()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE 
    t_title text;
BEGIN
    -- Only attempt to notify if 'assigned_user_id' exists and is set
    -- We use a Try-Catch block to ensure that if the notification 
    -- table has any issues, your main task data is ALWAYS saved.
    IF (NEW.assigned_user_id IS NOT NULL) THEN
        BEGIN
            -- Attempt to get the task title for the alert
            SELECT title INTO t_title FROM public.tasks WHERE id = NEW.task_id;
            
            -- Insert the alert record
            INSERT INTO public.notifications (user_id, title, body, type, related_task_id)
            VALUES (
                NEW.assigned_user_id, 
                'Work Unit Assignment', 
                'Action required in: ' || COALESCE(t_title, 'A task'), 
                'task_assigned', 
                NEW.task_id
            );
        EXCEPTION WHEN OTHERS THEN
            -- SILENT CATCH: This prevents the 'subtasks' insert from failing
            -- even if the notification system crashes.
            RETURN NEW;
        END;
    END IF;
    
    RETURN NEW;
END; $$;

-- 3. APPLY TO THE CORE TABLES
CREATE TRIGGER trg_subtask_assign_notify 
  AFTER INSERT OR UPDATE OF assigned_user_id ON public.subtasks 
  FOR EACH ROW EXECUTE FUNCTION public.notify_assignment_safe();

CREATE TRIGGER trg_platform_assign_notify 
  AFTER INSERT OR UPDATE OF assigned_user_id ON public.task_platforms 
  FOR EACH ROW EXECUTE FUNCTION public.notify_assignment_safe();
