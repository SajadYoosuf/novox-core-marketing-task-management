-- =========================================================
-- COMPLETE DATABASE RECONSTRUCTION (2026-04-05)
-- Purpose: Forcefully Recreate Missing Enums and Tables
-- =========================================================

-- 1. DROP FAILING TRIGGERS FIRST
DROP TRIGGER IF EXISTS trg_task_assign_notify ON public.task_assignees;
DROP TRIGGER IF EXISTS trg_subtask_assign_notify ON public.subtasks;
DROP TRIGGER IF EXISTS trg_platform_assign_notify ON public.task_platforms;

-- 2. CREATE MISSING ENUMS (SAFE BLOCKS)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE public.notification_type AS ENUM (
            'task_assigned', 'task_completed', 'task_deadline_soon', 'mention', 'comment', 'subtask_assigned', 'platform_assigned'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE public.task_status AS ENUM (
            'pending', 'in_progress', 'scheduled', 'posted', 'review', 'approved', 'completed', 'cancelled'
        );
    END IF;
END $$;

-- 3. CREATE/SYNC NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    title text NOT NULL,
    body text NOT NULL,
    type public.notification_type NOT NULL DEFAULT 'task_assigned',
    related_task_id uuid,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- 4. CREATE/SYNC SUBTASKS TABLE
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

-- 5. REINSTALL ALL TRIGGER FUNCTIONS
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger AS $$
DECLARE t_title text;
BEGIN
  SELECT title INTO t_title FROM public.tasks WHERE id = COALESCE(NEW.task_id, (NEW as any).task_id);
  INSERT INTO public.notifications (user_id, title, body, type, related_task_id)
  VALUES (COALESCE(NEW.user_id, NEW.assigned_user_id), 'Task Assignment', 'You were assigned work on: ' || t_title, 'task_assigned', NEW.task_id);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- 6. REAPPLY ALL TRIGGERS
CREATE TRIGGER trg_task_assign_notify AFTER INSERT ON public.task_assignees FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();
CREATE TRIGGER trg_subtask_assign_notify AFTER INSERT OR UPDATE OF assigned_user_id ON public.subtasks FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();
CREATE TRIGGER trg_platform_assign_notify AFTER INSERT OR UPDATE OF assigned_user_id ON public.task_platforms FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- 7. RLS PERMISSIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS n_select ON public.notifications;
CREATE POLICY n_select ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS st_write ON public.subtasks;
CREATE POLICY st_write ON public.subtasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS st_select ON public.subtasks;
CREATE POLICY st_select ON public.subtasks FOR SELECT TO authenticated USING (true);
