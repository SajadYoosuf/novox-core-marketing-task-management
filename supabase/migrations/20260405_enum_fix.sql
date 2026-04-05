-- =========================================================
-- ENUM REPAIR SCRIPT (2026-04-05)
-- Purpose: Fix trigger failures by adding missing notification types
-- =========================================================

-- 1. ADD MISSING TYPES TO NOTIFICATION ENUM
-- Since PostgreSQL doesn't allow 'IF NOT EXISTS' for enum values easily, we use this safe block:
DO $$ BEGIN
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'subtask_assigned';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'platform_assigned';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. ENSURE TRIGGER FUNCTIONS USE VALID TYPES
CREATE OR REPLACE FUNCTION public.notify_subtask_assigned()
RETURNS trigger AS $$
DECLARE t_title text;
BEGIN
  IF NEW.assigned_user_id IS NOT NULL THEN
    SELECT title INTO t_title FROM public.tasks WHERE id = NEW.task_id;
    -- Use 'task_assigned' if the specific 'subtask_assigned' enum update hasn't propagated yet
    INSERT INTO public.notifications (user_id, title, body, type, related_task_id)
    VALUES (
      NEW.assigned_user_id, 
      'Task Unit Assigned', 
      'Task Unit: ' || NEW.title || ' in ' || t_title, 
      'task_assigned', -- Fallback to existing type to be 100% safe
      NEW.task_id
    );
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.notify_platform_assign()
RETURNS trigger AS $$
DECLARE t_title text; p_name text;
BEGIN
  IF NEW.assigned_user_id IS NOT NULL THEN
    SELECT title INTO t_title FROM public.tasks WHERE id = NEW.task_id;
    SELECT platform INTO p_name FROM public.client_platforms WHERE id = NEW.client_platform_id;
    INSERT INTO public.notifications (user_id, title, body, type, related_task_id)
    VALUES (
      NEW.assigned_user_id, 
      'Platform Posting', 
      'Post ' || t_title || ' on ' || UPPER(p_name), 
      'task_assigned', -- Fallback to existing type to be 100% safe
      NEW.task_id
    );
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
