-- Ensure wallet/financial tables have expected privileges.
-- Some environments can drift and lose grants, causing
-- "permission denied for table ..." in admin financial screens.

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Authenticated access remains constrained by RLS policies.
GRANT SELECT, INSERT, UPDATE ON TABLE public.wallets TO authenticated;
GRANT SELECT ON TABLE public.wallet_funding TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.withdrawal_requests TO authenticated;

-- Service role is used by trusted server-side operations.
GRANT ALL PRIVILEGES ON TABLE public.wallets TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.wallet_funding TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.withdrawal_requests TO service_role;