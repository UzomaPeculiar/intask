
-- Restore authenticated grants after security lockdown, using column-level privileges
-- to keep sensitive columns (email, phone, verification docs) hidden from broad reads.

-- profiles: public-safe columns readable by any authenticated user
GRANT SELECT (id, full_name, avatar_url, role, bio, onboarded, created_at, updated_at)
  ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url, role, bio, onboarded, phone, email, updated_at)
  ON public.profiles TO authenticated;

-- student_profiles: public-safe columns readable by any authenticated user
GRANT SELECT (user_id, university, department, year_of_study, skills, portfolio,
              verified, rating_average, rating_count, tasks_completed,
              created_at, updated_at)
  ON public.student_profiles TO authenticated;
GRANT INSERT ON public.student_profiles TO authenticated;
GRANT UPDATE ON public.student_profiles TO authenticated;

-- Owner-scoped views expose sensitive columns only to the row's owner
GRANT SELECT ON public.my_profile TO authenticated;
GRANT SELECT ON public.my_student_profile TO authenticated;

-- Ensure explicit own-row policies exist (idempotent)
DROP POLICY IF EXISTS "users read own profile" ON public.profiles;
CREATE POLICY "users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "users read own student profile" ON public.student_profiles;
CREATE POLICY "users read own student profile" ON public.student_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users update own student profile" ON public.student_profiles;
CREATE POLICY "users update own student profile" ON public.student_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
