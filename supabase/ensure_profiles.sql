-- =============================================================================
-- Fix: "Could not find the table 'public.profiles' in the schema cache"
-- =============================================================================
-- Run this in Supabase: Dashboard → SQL Editor → New query → Paste → Run.
-- Then: Dashboard → Settings → API → click "Reload schema" (or wait ~1 minute).
--
-- For the full app (clients, tasks, …) also run:
--   supabase/migrations/20260404000000_initial_schema.sql
-- If that fails partway because some objects exist, run this file first, then
-- run the rest of the migration from the first failing line onward.
-- =============================================================================

-- Role enum (skip if already created, or update if missing values)
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'marketing_head', 'designer_head', 'designer', 'marketing_executive');
EXCEPTION
  WHEN duplicate_object THEN 
    -- Add new values if the type already exists
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'designer_head';
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'marketing_executive';
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  full_name text NOT NULL DEFAULT '',
  role public.user_role NOT NULL DEFAULT 'marketing_executive',
  password text, -- Store plain-text or hashed password for custom auth
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated ON public.profiles;
CREATE TRIGGER profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, password)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE 
      WHEN NEW.email = 'novoxcoretech@gmail.com' THEN 'admin'::public.user_role
      ELSE 'marketing_executive'::public.user_role
    END,
    NEW.raw_user_meta_data->>'password' -- Capture password from metadata if provided
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Users who signed up before the trigger existed
INSERT INTO public.profiles (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  'marketing_executive'::public.user_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_staff_elevated()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'marketing_head', 'designer_head')
  )
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_staff_elevated())
  WITH CHECK (true);

-- Tell PostgREST to refresh (helps clear "schema cache" errors)
NOTIFY pgrst, 'reload schema';

-- Migration: Update existing 'assistant' strings if they were cast or used before
-- Note: 'assistant' is NOT in the new enum list, so we must handle it if it exists.
-- If you already have 'assistant' data, you might need to cast it.
DO $$ BEGIN
  UPDATE public.profiles SET role = 'marketing_executive' WHERE role::text = 'assistant';
EXCEPTION WHEN OTHERS THEN 
  RAISE NOTICE 'Could not migrate assistant roles automatically.';
END $$;

-- Promote specific user to Admin
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'novoxcoretech@gmail.com';
