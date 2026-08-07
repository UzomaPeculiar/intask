ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS delivery_file_url TEXT,
  ADD COLUMN IF NOT EXISTS delivery_file_name TEXT;