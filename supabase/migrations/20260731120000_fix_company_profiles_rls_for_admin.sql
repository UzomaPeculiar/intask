-- Fix company_profiles RLS: allow admin users to read and update rows
-- This enables admin verification of companies

-- Admin can read all company profiles
DROP POLICY IF EXISTS "Company profiles admin read" ON public.company_profiles;
CREATE POLICY "Company profiles admin read" ON public.company_profiles
FOR SELECT TO authenticated
USING (public.is_admin_user());

-- Admin can update all company profiles (for approval/rejection)
DROP POLICY IF EXISTS "Company profiles admin update" ON public.company_profiles;
CREATE POLICY "Company profiles admin update" ON public.company_profiles
FOR UPDATE TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Admin can insert company profiles (for service_role operations)
DROP POLICY IF EXISTS "Company profiles admin insert" ON public.company_profiles;
CREATE POLICY "Company profiles admin insert" ON public.company_profiles
FOR INSERT TO authenticated
WITH CHECK (public.is_admin_user());
