-- Restore table grants used by Admin Overview command-center queries.
-- Some environments can drift and lose grants, causing
-- "permission denied for table ..." errors for admin overview.

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Authenticated grants (RLS still governs row access).
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.tasks TO authenticated;
GRANT SELECT ON TABLE public.transactions TO authenticated;
GRANT SELECT ON TABLE public.disputes TO authenticated;
GRANT SELECT ON TABLE public.reports TO authenticated;
GRANT SELECT ON TABLE public.withdrawal_requests TO authenticated;
GRANT SELECT ON TABLE public.wallet_funding TO authenticated;
GRANT SELECT ON TABLE public.student_profiles TO authenticated;
GRANT SELECT ON TABLE public.company_profiles TO authenticated;
GRANT SELECT ON TABLE public.individual_profiles TO authenticated;

-- Service role full access for trusted server-side admin functions.
GRANT ALL PRIVILEGES ON TABLE public.profiles TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.tasks TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.transactions TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.disputes TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.reports TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.withdrawal_requests TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.wallet_funding TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.student_profiles TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.company_profiles TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.individual_profiles TO service_role;