-- Admin notification access policies
-- Enables admin communication and notification log features

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users insert own notifs" ON public.notifications;
CREATE POLICY "users insert own notifs"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins read all notifs" ON public.notifications;
CREATE POLICY "admins read all notifs"
  ON public.notifications FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "admins insert any notif" ON public.notifications;
CREATE POLICY "admins insert any notif"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "admins update any notif" ON public.notifications;
CREATE POLICY "admins update any notif"
  ON public.notifications FOR UPDATE TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));
