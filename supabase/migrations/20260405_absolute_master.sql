-- =========================================================
-- ABSOLUTE MASTER RECONSTRUCTION (2026-04-05)
-- Purpose: Force Rebuild Entire Core Schema (Indestructible)
-- =========================================================

-- 1. SAFE CLEANUP (Using DO blocks to ignore "Not Exists" errors)
DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_task_assign_notify ON public.task_assignees;
    DROP TRIGGER IF EXISTS trg_subtask_assign_notify ON public.subtasks;
    DROP TRIGGER IF EXISTS trg_platform_assign_notify ON public.task_platforms;
    DROP POLICY IF EXISTS st_write ON public.subtasks;
    DROP POLICY IF EXISTS st_select ON public.subtasks;
    DROP POLICY IF EXISTS n_select ON public.notifications;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 2. CORE ENUMS (Recreate IF NOT EXISTS)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('admin', 'marketing_head', 'designer_head', 'designer', 'marketing_executive');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'scheduled', 'posted', 'review', 'approved', 'completed', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
        CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE public.notification_type AS ENUM ('task_assigned', 'task_completed', 'task_deadline_soon', 'mention', 'comment', 'subtask_assigned', 'platform_assigned');
    END IF;
END $$;

-- 3. CORE TABLES (MANDATORY REBUILD)
-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    email text,
    full_name text NOT NULL DEFAULT '',
    role public.user_role NOT NULL DEFAULT 'marketing_executive',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Clients
CREATE TABLE IF NOT EXISTS public.clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    industry text NOT NULL DEFAULT ''
);

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
    title text NOT NULL,
    description text DEFAULT '',
    priority public.task_priority NOT NULL DEFAULT 'medium',
    status public.task_status NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Task Assignees (The missing link!)
CREATE TABLE IF NOT EXISTS public.task_assignees (
    task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, user_id)
);

-- Subtasks (Designer Work)
CREATE TABLE IF NOT EXISTS public.subtasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
    title text NOT NULL,
    is_done boolean NOT NULL DEFAULT false,
    status public.task_status NOT NULL DEFAULT 'pending',
    assigned_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
    client_platform_id uuid REFERENCES public.client_platforms (id) ON DELETE SET NULL
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    title text NOT NULL,
    body text NOT NULL,
    type public.notification_type NOT NULL DEFAULT 'task_assigned',
    related_task_id uuid,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. MASTER RLS
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY st_write ON public.subtasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY st_select ON public.subtasks FOR SELECT TO authenticated USING (true);
    CREATE POLICY n_select ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 5. FINAL TRIGGER FIX
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type, related_task_id)
  VALUES (COALESCE(NEW.user_id, NEW.assigned_user_id), 'Assigned Work Update', 'New work unit in the dashboard.', 'task_assigned', NEW.task_id);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
    CREATE TRIGGER trg_task_assign_notify AFTER INSERT ON public.task_assignees FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();
    CREATE TRIGGER trg_subtask_assign_notify AFTER INSERT OR UPDATE OF assigned_user_id ON public.subtasks FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
