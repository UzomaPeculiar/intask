-- Live environments (e.g. Lovable-managed Supabase projects) can drift from
-- the repo migrations: the wallet_transactions table may be missing the
-- service_role UPDATE grant that the original migration declared. That makes
-- webhook / client-sync / admin-reconciliation status updates fail silently,
-- leaving withdrawals stuck on "pending" in wallet activity even after Paystack
-- confirms the transfer.
--
-- This migration is idempotent and safe to apply anywhere, including on top of
-- a database where the equivalent GRANT was already applied manually.

GRANT UPDATE ON TABLE public.wallet_transactions TO service_role;

-- Backfill ledger rows for withdrawals Paystack already completed, so wallet
-- activity catches up with the withdrawal records. Safe to re-run: it only
-- flips pending rows whose withdrawal is already marked completed.
UPDATE public.wallet_transactions wt
SET status = 'completed'
FROM public.withdrawal_requests wr
WHERE wr.reference = wt.reference
  AND wr.status = 'completed'
  AND wt.status = 'pending';
