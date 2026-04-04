-- Add new values to the platform_type enum
-- Note: PostgreSQL doesn't allow adding values inside a transaction easily, 
-- but these commands can be run in the Supabase SQL editor.
ALTER TYPE public.platform_type ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE public.platform_type ADD VALUE IF NOT EXISTS 'threads';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
