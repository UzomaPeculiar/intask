-- Track when a task is featured so monthly featured quotas can be enforced.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS featured_set_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS tasks_poster_featured_set_at_idx
  ON public.tasks (poster_id, featured_set_at DESC)
  WHERE featured_set_at IS NOT NULL;
