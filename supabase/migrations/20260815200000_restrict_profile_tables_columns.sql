-- Restrict reads on profiles / student_profiles / individual_profiles.
--
-- Why: migration 20260806150000 (the "fix overview table permissions" drift
-- fix) restored whole-table SELECT grants to authenticated on all three tables,
-- silently defeating the column-level protection originally set up in
-- 20260708004330. As a result every signed-in user can read every user's
-- email/phone (profiles), university_email / id_upload_path /
-- verification_doc_url / verification_status (student_profiles), and
-- id_type / id_upload_path / verification_status (individual_profiles).
--
-- This re-applies the column-level restriction and adds:
--   * my_*  views -- full row, owner only (auth.uid() scope)
--   * admin_* views -- full rows, admins only (is_admin_user() scope)
-- Plain views (no security_invoker) so they run with the migration role's
-- privileges; the WHERE clause is the sole gate and auth.uid()/is_admin_user()
-- cannot be spoofed. is_admin_user() is SECURITY DEFINER, so admin checks keep
-- working for RLS policies even though the is_admin column is no longer granted.

-- ============================ PROFILES ============================
REVOKE SELECT ON TABLE public.profiles FROM authenticated, anon;
GRANT SELECT (id, full_name, avatar_url, bio, role, onboarded, created_at, updated_at)
  ON public.profiles TO authenticated;

-- Owner full-row view (clears security_invoker set in the original migration).
CREATE OR REPLACE VIEW public.my_profile WITH (security_invoker = false) AS
  SELECT * FROM public.profiles WHERE id = auth.uid();
REVOKE ALL ON public.my_profile FROM anon, public;
GRANT SELECT ON public.my_profile TO authenticated;

-- Admin full-row view.
DROP VIEW IF EXISTS public.admin_profiles;
CREATE VIEW public.admin_profiles AS
  SELECT * FROM public.profiles WHERE public.is_admin_user();
REVOKE ALL ON public.admin_profiles FROM anon, public;
GRANT SELECT ON public.admin_profiles TO authenticated;

-- ============================ STUDENT_PROFILES ============================
REVOKE SELECT ON TABLE public.student_profiles FROM authenticated, anon;
GRANT SELECT (user_id, department, portfolio, rating_average, rating_count,
              skills, tasks_completed, university, verified, year_of_study,
              verification_method, created_at, updated_at)
  ON public.student_profiles TO authenticated;

CREATE OR REPLACE VIEW public.my_student_profile WITH (security_invoker = false) AS
  SELECT * FROM public.student_profiles WHERE user_id = auth.uid();
REVOKE ALL ON public.my_student_profile FROM anon, public;
GRANT SELECT ON public.my_student_profile TO authenticated;

DROP VIEW IF EXISTS public.admin_student_profiles;
CREATE VIEW public.admin_student_profiles AS
  SELECT * FROM public.student_profiles WHERE public.is_admin_user();
REVOKE ALL ON public.admin_student_profiles FROM anon, public;
GRANT SELECT ON public.admin_student_profiles TO authenticated;

-- ============================ INDIVIDUAL_PROFILES ============================
REVOKE SELECT ON TABLE public.individual_profiles FROM authenticated, anon;
GRANT SELECT (user_id, verified, created_at, updated_at)
  ON public.individual_profiles TO authenticated;

DROP VIEW IF EXISTS public.my_individual_profile;
CREATE VIEW public.my_individual_profile AS
  SELECT * FROM public.individual_profiles WHERE user_id = auth.uid();
REVOKE ALL ON public.my_individual_profile FROM anon, public;
GRANT SELECT ON public.my_individual_profile TO authenticated;

DROP VIEW IF EXISTS public.admin_individual_profiles;
CREATE VIEW public.admin_individual_profiles AS
  SELECT * FROM public.individual_profiles WHERE public.is_admin_user();
REVOKE ALL ON public.admin_individual_profiles FROM anon, public;
GRANT SELECT ON public.admin_individual_profiles TO authenticated;
