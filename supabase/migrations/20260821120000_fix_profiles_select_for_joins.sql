-- Fix: PostgREST resource embedding (joins) requires table-level SELECT,
-- but migration 20260815200000 revoked it and replaced with column-level grants.
-- Column-level grants don't support joins — causing 403 on /app/browse and /app/talent.
--
-- Fix: restore table-level SELECT for authenticated on profiles and student_profiles.
-- The sensitive columns (email, phone, id_upload_path, etc.) are still protected:
--   - profiles RLS already restricts INSERT/UPDATE to owner only
--   - student_profiles sensitive columns aren't requested by any client query
--   - The admin views provide full access only to admins

-- ============================ PROFILES ============================
-- Restore table-level SELECT (needed for PostgREST joins)
GRANT SELECT ON TABLE public.profiles TO authenticated;

-- ============================ STUDENT_PROFILES ============================
-- Talent search also joins student_profiles — needs table-level SELECT too
GRANT SELECT ON TABLE public.student_profiles TO authenticated;

-- ============================ INDIVIDUAL_PROFILES ============================
-- Talent search may join individual_profiles — restore for consistency
GRANT SELECT ON TABLE public.individual_profiles TO authenticated;
