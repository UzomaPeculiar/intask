ALTER TABLE public.task_team_members
  ADD COLUMN IF NOT EXISTS delivery_title TEXT,
  ADD COLUMN IF NOT EXISTS delivery_message TEXT,
  ADD COLUMN IF NOT EXISTS delivery_url TEXT,
  ADD COLUMN IF NOT EXISTS delivery_file_url TEXT,
  ADD COLUMN IF NOT EXISTS delivery_file_name TEXT,
  ADD COLUMN IF NOT EXISTS delivery_submitted_at TIMESTAMPTZ;

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_task_id_reviewer_id_key;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_task_id_reviewer_id_reviewee_id_key UNIQUE (task_id, reviewer_id, reviewee_id);