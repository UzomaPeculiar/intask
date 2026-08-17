-- Fix audit_log / announcements access for the admin dashboard.
--
-- The admin Settings server functions read audit_log and announcements with
-- the service-role client (which bypasses RLS but still needs table grants).
-- audit_log and announcements only ever received grants for authenticated,
-- so the Settings tab failed with "permission denied for table audit_log"
-- even through the server function.
--
-- The RLS policies on both tables also check
-- `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)`,
-- which breaks since 20260815200000 revoked the is_admin column grant from
-- authenticated. Recreate them with public.is_admin_user(auth.uid()).

ALTER TABLE IF EXISTS public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.announcements ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON TABLE public.audit_log TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.announcements TO authenticated, service_role;

-- ============================ AUDIT LOG ============================
DROP POLICY IF EXISTS "Admins can view audit log" ON public.audit_log;
CREATE POLICY "Admins can view audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "System can insert audit log" ON public.audit_log;
CREATE POLICY "System can insert audit log"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()));

-- ============================ ANNOUNCEMENTS ============================
-- Everyone can still read active announcements.
DROP POLICY IF EXISTS "Anyone can view active announcements" ON public.announcements;
CREATE POLICY "Anyone can view active announcements"
  ON public.announcements FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "Admins can manage announcements"
  ON public.announcements FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));
