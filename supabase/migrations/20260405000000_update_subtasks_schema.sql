-- Update subtasks table to support assignees and platform mapping
-- Add columns to public.subtasks

ALTER TABLE public.subtasks
ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.subtasks
ADD COLUMN IF NOT EXISTS client_platform_id uuid REFERENCES public.client_platforms (id) ON DELETE SET NULL;

-- Ensure RLS is updated (though it was already using 'true')
DROP POLICY IF EXISTS st_select ON public.subtasks;
CREATE POLICY st_select ON public.subtasks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS st_write ON public.subtasks;
CREATE POLICY st_write ON public.subtasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
