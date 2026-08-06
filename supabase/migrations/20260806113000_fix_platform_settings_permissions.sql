-- Fix platform_settings permissions for admin settings/moderation writes.
-- Some environments may miss earlier grants, causing "permission denied for table platform_settings".

ALTER TABLE IF EXISTS public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Ensure base table privileges exist for authenticated and service role clients.
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.platform_settings TO authenticated, service_role;

-- Recreate admin-only RLS policies idempotently.
DROP POLICY IF EXISTS "Admins can read settings" ON public.platform_settings;
CREATE POLICY "Admins can read settings"
  ON public.platform_settings FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Admins can update settings" ON public.platform_settings;
CREATE POLICY "Admins can update settings"
  ON public.platform_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Admins can insert settings" ON public.platform_settings;
CREATE POLICY "Admins can insert settings"
  ON public.platform_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Ensure moderation key exists so future saves can update existing row.
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'banned_words_rules',
  '["bitcoin","crypto","adult","sex","loan","bet","gamble","scam"]'::jsonb,
  'Keywords used for automatic moderation flagging'
)
ON CONFLICT (key) DO NOTHING;
