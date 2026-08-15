-- Secure private storage buckets (resumes, student-ids).
--
-- The resumes and student-ids buckets were created outside the migration set.
-- Confirmed in prod: both buckets are already private (public = false) and
-- storage.objects RLS is enabled, but the dashboard-created policies are not
-- fully owner-scoped — the INSERT policies allow ANY authenticated user to
-- upload to any path in these buckets (bucket + role only, no owner folder
-- check), and resumes has no UPDATE policy at all (upsert re-uploads of the
-- constant-path resume fail). This migration makes the state reproducible and
-- canonical:
--   * forces public = false on the buckets (no-op where already private)
--   * drops the dashboard-created policies and recreates the owner-scoped set
--     used by company-docs / individual-docs: upload/read/update own (first
--     path segment must equal auth.uid()) plus admin read.

-- Buckets: private. DO UPDATE forces public = false even if the bucket was
-- created with the public toggle on in the dashboard.
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

INSERT INTO storage.buckets (id, name, public)
VALUES ('student-ids', 'student-ids', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- ============================================================================
-- resumes
-- ============================================================================
DROP POLICY IF EXISTS "Users can upload own resume" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own resume" ON storage.objects;
DROP POLICY IF EXISTS "Resume upload" ON storage.objects;
DROP POLICY IF EXISTS "Resume read own" ON storage.objects;
DROP POLICY IF EXISTS "Resume update own" ON storage.objects;
DROP POLICY IF EXISTS "Admin read resumes" ON storage.objects;

CREATE POLICY "Resume upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Resume read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Resume update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admin read resumes" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes'
    AND public.is_admin_user()
  );

-- ============================================================================
-- student-ids
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can upload student IDs" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own student ID" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own student ID" ON storage.objects;
DROP POLICY IF EXISTS "Admin can read all student IDs" ON storage.objects;
DROP POLICY IF EXISTS "Student ID upload" ON storage.objects;
DROP POLICY IF EXISTS "Student ID read own" ON storage.objects;
DROP POLICY IF EXISTS "Student ID update own" ON storage.objects;
DROP POLICY IF EXISTS "Admin read student IDs" ON storage.objects;

CREATE POLICY "Student ID upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-ids'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Student ID read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-ids'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Student ID update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'student-ids'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admin read student IDs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-ids'
    AND public.is_admin_user()
  );
