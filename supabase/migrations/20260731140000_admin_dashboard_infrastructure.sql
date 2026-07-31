-- Admin Dashboard Infrastructure
-- Tables: audit_log, platform_settings, announcements

-- ============================================================
-- 1. AUDIT LOG — every admin action gets logged
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,           -- e.g. 'user.approve', 'user.suspend', 'task.force_cancel', 'settings.update'
  target_type TEXT NOT NULL,      -- e.g. 'user', 'task', 'dispute', 'settings', 'announcement'
  target_id TEXT,                 -- UUID of the affected record, nullable for system-wide actions
  details JSONB DEFAULT '{}'::jsonb,  -- arbitrary metadata (old values, new values, reason, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_admin_idx ON public.audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS audit_log_target_idx ON public.audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON public.audit_log(created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read; inserts done via service_role or edge functions
CREATE POLICY "Admins can view audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "System can insert audit log"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================================
-- 2. PLATFORM SETTINGS — configurable fees, limits, toggles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Admins can read and update settings
CREATE POLICY "Admins can read settings"
  ON public.platform_settings FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update settings"
  ON public.platform_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can insert settings"
  ON public.platform_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Seed default settings
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('platform_fee_percent', '8', 'Platform fee percentage charged on each completed task'),
  ('min_withdrawal_amount', '550', 'Minimum withdrawal amount in Naira'),
  ('featured_task_slots', '10', 'Maximum number of featured tasks at any time'),
  ('maintenance_mode', 'false', 'When true, non-admin users see a maintenance page'),
  ('min_task_budget', '1000', 'Minimum task budget in Naira')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 3. ANNOUNCEMENTS — platform broadcasts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_role TEXT,              -- NULL = all users, or 'student', 'company', 'individual', 'alumni'
  is_active BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_active_idx ON public.announcements(is_active, published_at DESC);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Everyone can read active announcements
CREATE POLICY "Anyone can view active announcements"
  ON public.announcements FOR SELECT TO authenticated
  USING (is_active = true);

-- Only admins can manage announcements
CREATE POLICY "Admins can manage announcements"
  ON public.announcements FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================================
-- 4. Add account_status to profiles (suspend/ban support)
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active'
    CHECK (account_status IN ('active', 'suspended', 'banned'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- 5. Helper function: log admin action
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _admin_id UUID,
  _action TEXT,
  _target_type TEXT,
  _target_id TEXT DEFAULT NULL,
  _details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.audit_log (admin_user_id, action, target_type, target_id, details)
  VALUES (_admin_id, _action, _target_type, _target_id, _details)
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_admin_action(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
