
-- Restore grants that were dropped by the security hardening migration.
-- RLS policies remain in place and continue to gate row access.

-- profiles: public-safe columns readable by any authenticated user; sensitive
-- columns (email, phone) accessible only via my_profile view (owner-only).
GRANT SELECT (id, full_name, avatar_url, role, bio, onboarded, created_at, updated_at) ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url, role, bio, onboarded, phone, email, updated_at) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- student_profiles: public-safe columns for browsing; sensitive fields (email,
-- verification docs) only via my_student_profile view.
GRANT SELECT (user_id, university, department, year_of_study, skills, portfolio, verified, rating_average, rating_count, tasks_completed, created_at, updated_at) ON public.student_profiles TO authenticated;
GRANT INSERT, UPDATE ON public.student_profiles TO authenticated;
GRANT ALL ON public.student_profiles TO service_role;

-- company_profiles: all columns are non-sensitive
GRANT SELECT, INSERT, UPDATE ON public.company_profiles TO authenticated;
GRANT ALL ON public.company_profiles TO service_role;

-- Owner-only views
GRANT SELECT ON public.my_profile TO authenticated;
GRANT SELECT ON public.my_student_profile TO authenticated;

-- Other app tables — restore full CRUD to authenticated (RLS enforces row scope)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_projects TO authenticated;
GRANT ALL ON public.student_projects TO service_role;
