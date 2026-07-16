
-- === profiles_public_email_phone ===
DROP POLICY IF EXISTS "profiles readable by anyone" ON public.profiles;
CREATE POLICY "profiles readable by authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);

REVOKE SELECT (email, phone) ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_email()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_my_email() TO authenticated;

-- === delivery_poster_bypass ===
DROP POLICY IF EXISTS "posters update own tasks" ON public.tasks;
CREATE POLICY "posters update own tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (auth.uid() = poster_id AND status <> 'in_progress'::task_status)
  WITH CHECK (auth.uid() = poster_id AND status <> 'in_review'::task_status);

DROP POLICY IF EXISTS "matched student submits delivery" ON public.tasks;
CREATE POLICY "matched student submits delivery"
  ON public.tasks FOR UPDATE TO authenticated
  USING (auth.uid() = matched_student_id AND status = 'in_progress'::task_status)
  WITH CHECK (auth.uid() = matched_student_id AND status = 'in_review'::task_status);

-- === review_no_task_check ===
DROP POLICY IF EXISTS "reviewer inserts" ON public.reviews;
CREATE POLICY "reviewer inserts"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id
        AND t.status = 'completed'::task_status
        AND (t.poster_id = auth.uid() OR t.matched_student_id = auth.uid())
    )
  );

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_rating_range;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5);
