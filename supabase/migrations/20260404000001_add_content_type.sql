-- Update the tasks table to include content_type
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS content_type text DEFAULT 'static';

-- Refresh PostgREST
NOTIFY pgrst, 'reload schema';
