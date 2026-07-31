-- Ensure authenticated role has table privileges for admin-managed tables.
-- RLS policies still enforce admin-only access logic.

GRANT SELECT, INSERT, UPDATE ON TABLE public.platform_settings TO authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.announcements TO authenticated;
