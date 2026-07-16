
-- Drop existing conflicting policies
DROP POLICY IF EXISTS "student or poster updates" ON public.applications;
DROP POLICY IF EXISTS "students apply" ON public.applications;
DROP POLICY IF EXISTS "students see own apps" ON public.applications;
DROP POLICY IF EXISTS "students withdraw" ON public.applications;
DROP POLICY IF EXISTS "Students can insert own applications" ON public.applications;
DROP POLICY IF EXISTS "Students can view own applications" ON public.applications;
DROP POLICY IF EXISTS "Posters can view applications on their tasks" ON public.applications;
DROP POLICY IF EXISTS "Posters can update application status" ON public.applications;
DROP POLICY IF EXISTS "Students can withdraw own applications" ON public.applications;

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Policy 1: students insert their own applications
CREATE POLICY "Students can insert own applications"
  ON public.applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- Policy 2: students view their own applications
CREATE POLICY "Students can view own applications"
  ON public.applications FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

-- Policy 3: posters view applications on their tasks
CREATE POLICY "Posters can view applications on their tasks"
  ON public.applications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = applications.task_id AND tasks.poster_id = auth.uid()));

-- Policy 4: posters update application status on their tasks
CREATE POLICY "Posters can update application status"
  ON public.applications FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = applications.task_id AND tasks.poster_id = auth.uid()));

-- Policy 5b: students can withdraw own
CREATE POLICY "Students can withdraw own applications"
  ON public.applications FOR DELETE TO authenticated
  USING (auth.uid() = student_id);

-- Safe public applicant count — SECURITY DEFINER RPC only returns integer aggregate,
-- never exposes student_id, message, or status. Available to any signed-in or anonymous client.
CREATE OR REPLACE FUNCTION public.get_task_applicant_count(_task_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.applications WHERE task_id = _task_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_task_applicant_count(uuid) TO anon, authenticated;

-- Ensure REPLICA IDENTITY FULL so realtime DELETE payloads include task_id
ALTER TABLE public.applications REPLICA IDENTITY FULL;
