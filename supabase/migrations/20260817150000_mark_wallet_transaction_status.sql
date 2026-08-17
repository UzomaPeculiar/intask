-- Live environments (e.g. Lovable-managed Supabase projects) can drift from
-- the repo migrations, and table-level grants on wallet_transactions are not
-- reliably present. Direct UPDATEs from webhook / client-sync / admin
-- reconciliation code then fail silently, leaving withdrawals stuck on
-- "pending" in wallet activity even though Paystack confirmed the transfer.
--
-- This SECURITY DEFINER function runs as the table owner (like credit_wallet
-- and debit_wallet_atomic already do), so it bypasses RLS and column grants.
-- All status-flipping code paths should call this instead of updating
-- wallet_transactions directly.

CREATE OR REPLACE FUNCTION public.mark_wallet_transaction_status(
  p_user_id UUID,
  p_reference TEXT,
  p_status TEXT DEFAULT 'completed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_reference IS NULL OR p_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_id, reference and status are required');
  END IF;

  UPDATE public.wallet_transactions
  SET status = p_status
  WHERE user_id = p_user_id
    AND reference = p_reference;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'updated', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_wallet_transaction_status(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_wallet_transaction_status(UUID, TEXT, TEXT) TO service_role;

-- Backfill ledger rows for withdrawals Paystack already completed. Safe to
-- re-run: it only flips pending rows whose withdrawal is already completed.
UPDATE public.wallet_transactions wt
SET status = 'completed'
FROM public.withdrawal_requests wr
WHERE wr.reference = wt.reference
  AND wr.status = 'completed'
  AND wt.status = 'pending';
