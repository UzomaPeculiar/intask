-- Repair permissions/policies for task_team_members
-- Fixes runtime: permission denied for table task_team_members

ALTER TABLE IF EXISTS public.task_team_members ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.task_team_members TO authenticated;
GRANT ALL ON TABLE public.task_team_members TO service_role;

DROP POLICY IF EXISTS "team members readable by participants" ON public.task_team_members;
CREATE POLICY "team members readable by participants"
ON public.task_team_members
FOR SELECT TO authenticated
USING (
  public.is_admin_user(auth.uid())
  OR auth.uid() = student_id
  OR EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = public.task_team_members.task_id
      AND t.poster_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "team members managed by poster" ON public.task_team_members;
CREATE POLICY "team members managed by poster"
ON public.task_team_members
FOR ALL TO authenticated
USING (
  public.is_admin_user(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = public.task_team_members.task_id
      AND t.poster_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin_user(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = public.task_team_members.task_id
      AND t.poster_id = auth.uid()
  )
);
