-- Add 'scheduled' and 'posted' values to public.task_status enum
-- Run via: supabase db push

-- Postgres doesn't allow ALTER TYPE ... ADD VALUE within a transaction block for enums used elsewhere in some versions,
-- but standard addition in Supabase typically works like this:
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'task_status' AND e.enumlabel = 'scheduled') THEN
    ALTER TYPE public.task_status ADD VALUE 'scheduled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'task_status' AND e.enumlabel = 'posted') THEN
    ALTER TYPE public.task_status ADD VALUE 'posted';
  END IF;
END $$;
