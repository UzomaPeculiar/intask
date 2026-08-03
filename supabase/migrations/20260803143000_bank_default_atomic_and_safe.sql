CREATE OR REPLACE FUNCTION public.set_default_bank_account(
  p_bank_account_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_target_owner UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT ba.user_id
  INTO v_target_owner
  FROM public.bank_accounts ba
  WHERE ba.id = p_bank_account_id;

  IF v_target_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bank account not found');
  END IF;

  IF v_target_owner <> v_user_id AND NOT public.is_admin_user(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not allowed');
  END IF;

  UPDATE public.bank_accounts
  SET is_default = (id = p_bank_account_id)
  WHERE user_id = v_target_owner;

  RETURN jsonb_build_object('success', true, 'bank_account_id', p_bank_account_id);
END;
$$;

REVOKE ALL ON FUNCTION public.set_default_bank_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_default_bank_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_bank_account(UUID) TO service_role;