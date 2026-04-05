-- =========================================================
-- SAFE REPAIR & SYNC SCRIPT (2026-04-05)
-- Purpose: Create missing 'subtasks' table and sync all updates
-- =========================================================

-- 1. ENSURE STATUS ENUM EXISTS (if not already there)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'scheduled', 'posted', 'review', 'approved', 'completed', 'cancelled');
    END IF;
END $$;

-- 2. CREATE SUBTASKS TABLE (SAFE REPAIR)
CREATE TABLE IF NOT EXISTS public.subtasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
    title text NOT NULL,
    is_done boolean NOT NULL DEFAULT false,
    sort_order int NOT NULL DEFAULT 0,
    status public.task_status NOT NULL DEFAULT 'pending',
    assigned_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
    client_platform_id uuid REFERENCES public.client_platforms (id) ON DELETE SET NULL
);

-- 3. ENSURE COLUMNS EXIST (if table was partially created previously)
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS status public.task_status NOT NULL DEFAULT 'pending';
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS client_platform_id uuid REFERENCES public.client_platforms (id) ON DELETE SET NULL;

-- 4. MIGRATE DATA
UPDATE public.subtasks SET status = 'completed' WHERE is_done = true;
UPDATE public.subtasks SET status = 'in_progress' WHERE is_done = false AND task_id IN (SELECT id FROM public.tasks WHERE status = 'in_progress');

-- 5. REINSTALL NOTIFICATION TRIGGERS
CREATE OR REPLACE FUNCTION public.notify_subtask_assigned()
RETURNS trigger AS $$
DECLARE t_title text;
BEGIN
  IF NEW.assigned_user_id IS NOT NULL THEN
    SELECT title INTO t_title FROM public.tasks WHERE id = NEW.task_id;
    INSERT INTO public.notifications (user_id, title, body, type, related_task_id)
    VALUES (NEW.assigned_user_id, 'Technical Unit Assigned', 'You were assigned to: ' || NEW.title || ' in ' || t_title, 'subtask_assigned', NEW.task_id);
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subtask_assign_notify ON public.subtasks;
CREATE TRIGGER trg_subtask_assign_notify AFTER INSERT OR UPDATE OF assigned_user_id ON public.subtasks FOR EACH ROW EXECUTE FUNCTION public.notify_subtask_assigned();

-- Trigger for Marketing Platforms
CREATE OR REPLACE FUNCTION public.notify_platform_assign()
RETURNS trigger AS $$
DECLARE t_title text; p_name text;
BEGIN
  IF NEW.assigned_user_id IS NOT NULL THEN
    SELECT title INTO t_title FROM public.tasks WHERE id = NEW.task_id;
    SELECT platform INTO p_name FROM public.client_platforms WHERE id = NEW.client_platform_id;
    INSERT INTO public.notifications (user_id, title, body, type, related_task_id)
    VALUES (NEW.assigned_user_id, 'Posting Assignment', 'Please post ' || t_title || ' on ' || UPPER(p_name), 'platform_assigned', NEW.task_id);
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_platform_assign_notify ON public.task_platforms;
CREATE TRIGGER trg_platform_assign_notify AFTER INSERT OR UPDATE OF assigned_user_id ON public.task_platforms FOR EACH ROW EXECUTE FUNCTION public.notify_platform_assign();

-- 6. ENSURE RLS POLICIES
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS st_select ON public.subtasks;
CREATE POLICY st_select ON public.subtasks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS st_write ON public.subtasks;
CREATE POLICY st_write ON public.subtasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
