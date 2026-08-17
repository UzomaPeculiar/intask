-- Fix platform_settings RLS policies broken by column-level profile grants.
--
-- 20260731140000 and 20260806113000 created policies that check
-- `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)`.
-- Migration 20260815200000 revoked the `is_admin` column grant from
-- authenticated (admin checks now go through the SECURITY DEFINER
-- is_admin_user() helper), so those subqueries fail with "permission denied"
-- for every authenticated user. Symptom: the admin Settings tab shows no
-- platform settings and "Initialize defaults" fails with a permission error.
--
-- Recreate the policies using public.is_admin_user(auth.uid()), matching
-- every other admin policy in the project.

ALTER TABLE IF EXISTS public.platform_settings ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.platform_settings TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins can read settings" ON public.platform_settings;
CREATE POLICY "Admins can read settings"
  ON public.platform_settings FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update settings" ON public.platform_settings;
CREATE POLICY "Admins can update settings"
  ON public.platform_settings FOR UPDATE TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert settings" ON public.platform_settings;
CREATE POLICY "Admins can insert settings"
  ON public.platform_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()));
