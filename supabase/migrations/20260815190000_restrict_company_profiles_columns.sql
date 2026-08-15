-- Restrict company_profiles reads: only public-safe columns are readable by
-- authenticated users directly. Sensitive columns (company_email, cac_number,
-- verification_doc_url, verification_status, verification_method, verified_at)
-- are exposed only through:
--   * my_company_profile     -- full row, owner only (auth.uid() = user_id)
--   * admin_company_profiles -- full rows + profile name/email, admins only
--
-- Why this is needed: the SELECT policy "company profiles readable auth" is
-- USING (true), and migration 20260806150000 restored a whole-table SELECT
-- grant to authenticated. That means every signed-in user could read every
-- company's CAC number, private email, verification document path and
-- verification status through PostgREST. This restores the column-level
-- protection used for profiles/student_profiles.

-- 1) Remove whole-table SELECT for client roles; expose only public-safe columns.
REVOKE SELECT ON public.company_profiles FROM authenticated, anon;
GRANT SELECT (user_id, company_name, industry, location, website, verified, created_at, updated_at)
  ON public.company_profiles TO authenticated;

-- 2) Owner-only view: full row, scoped to the requesting user.
-- Created as a plain view so it runs with the view owner's privileges (the
-- migration role), while the WHERE clause limits results to auth.uid().
DROP VIEW IF EXISTS public.my_company_profile;
CREATE VIEW public.my_company_profile AS
  SELECT * FROM public.company_profiles WHERE user_id = auth.uid();
GRANT SELECT ON public.my_company_profile TO authenticated;

-- 3) Admin-only view: full rows (plus profile name/email for review UIs),
-- scoped to is_admin_user().
DROP VIEW IF EXISTS public.admin_company_profiles;
CREATE VIEW public.admin_company_profiles AS
  SELECT cp.*, p.full_name, p.email
  FROM public.company_profiles cp
  LEFT JOIN public.profiles p ON p.id = cp.user_id
  WHERE public.is_admin_user();
GRANT SELECT ON public.admin_company_profiles TO authenticated;
