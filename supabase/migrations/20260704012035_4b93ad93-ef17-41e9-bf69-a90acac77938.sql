-- Enable realtime for applications table so posters get live updates
ALTER TABLE public.applications REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;

-- Trigger to keep tasks.applicants_count in sync (function already exists)
DROP TRIGGER IF EXISTS trg_bump_applicants_count ON public.applications;
CREATE TRIGGER trg_bump_applicants_count
AFTER INSERT OR DELETE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.bump_applicants_count();

-- Backfill existing counts
UPDATE public.tasks t
SET applicants_count = COALESCE(sub.c, 0)
FROM (SELECT task_id, COUNT(*)::int AS c FROM public.applications WHERE status = 'pending' GROUP BY task_id) sub
WHERE t.id = sub.task_id;
