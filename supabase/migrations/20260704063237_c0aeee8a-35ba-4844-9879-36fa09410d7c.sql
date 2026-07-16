-- Drop duplicate triggers (keep trg_bump_applicants_count)
DROP TRIGGER IF EXISTS applications_count_ins ON public.applications;
DROP TRIGGER IF EXISTS applications_count_del ON public.applications;

-- Backfill applicants_count from actual data
UPDATE public.tasks t
SET applicants_count = COALESCE(sub.c, 0)
FROM (
  SELECT task_id, COUNT(*)::int AS c FROM public.applications GROUP BY task_id
) sub
WHERE sub.task_id = t.id;

UPDATE public.tasks
SET applicants_count = 0
WHERE id NOT IN (SELECT task_id FROM public.applications) AND applicants_count <> 0;