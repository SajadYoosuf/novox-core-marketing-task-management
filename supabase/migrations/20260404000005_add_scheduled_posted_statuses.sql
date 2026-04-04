-- Synchronize task statuses for high-end marketing workflow
-- Run via: supabase db push

-- Add 'scheduled' and 'posted' to the task_status enum if they don't exist
-- Note: 'IF NOT EXISTS' for ADD VALUE depends on Postgres version; 
-- standard ALTER TYPE is more robust in migrations.
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'posted';
