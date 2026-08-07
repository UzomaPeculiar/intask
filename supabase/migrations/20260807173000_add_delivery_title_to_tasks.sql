ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS delivery_title TEXT;