
-- PROFILES: restrict email/phone via column privileges + policy split
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "profiles limited public read" ON public.profiles FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (id, full_name, avatar_url, bio, role, onboarded, created_at, updated_at) ON public.profiles TO authenticated;
GRANT SELECT (id, full_name, avatar_url, bio, role, email, phone, onboarded, created_at, updated_at) ON public.profiles TO authenticated;
-- (second grant is a no-op superset — we need owner-only for email/phone. Use a view-less approach: split policies won't help column-level. Use a security-definer helper via policy.)
-- Simpler: grant only safe columns broadly; owner reads full row via a separate mechanism.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, avatar_url, bio, role, onboarded, created_at, updated_at) ON public.profiles TO authenticated;
-- Owner needs email/phone — grant conditionally via a view
CREATE OR REPLACE VIEW public.my_profile WITH (security_invoker=true) AS
  SELECT * FROM public.profiles WHERE id = auth.uid();
GRANT SELECT ON public.my_profile TO authenticated;

-- STUDENT_PROFILES: hide verification_doc_url + university_email from non-owners
DROP POLICY IF EXISTS "student profiles readable" ON public.student_profiles;
CREATE POLICY "student profiles readable auth" ON public.student_profiles FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.student_profiles FROM anon, authenticated;
GRANT SELECT (user_id, department, portfolio, rating_average, rating_count, skills, tasks_completed, university, verified, year_of_study, verification_method, created_at, updated_at) ON public.student_profiles TO authenticated;
CREATE OR REPLACE VIEW public.my_student_profile WITH (security_invoker=true) AS
  SELECT * FROM public.student_profiles WHERE user_id = auth.uid();
GRANT SELECT ON public.my_student_profile TO authenticated;

-- COMPANY_PROFILES: authenticated only, not anon
DROP POLICY IF EXISTS "company profiles readable" ON public.company_profiles;
CREATE POLICY "company profiles readable auth" ON public.company_profiles FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.company_profiles FROM anon;

-- REVIEWS: authenticated only, not anon
DROP POLICY IF EXISTS "reviews public" ON public.reviews;
CREATE POLICY "reviews readable auth" ON public.reviews FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.reviews FROM anon;

-- TASKS: open tasks visible to all authenticated; non-open only to poster or matched student
DROP POLICY IF EXISTS "tasks readable by authenticated" ON public.tasks;
CREATE POLICY "open tasks readable" ON public.tasks FOR SELECT TO authenticated
  USING (status = 'open' OR auth.uid() = poster_id OR auth.uid() = matched_student_id);

-- SECURITY DEFINER function: lock down execute
REVOKE EXECUTE ON FUNCTION public.get_task_applicant_count(uuid) FROM PUBLIC, anon, authenticated;
