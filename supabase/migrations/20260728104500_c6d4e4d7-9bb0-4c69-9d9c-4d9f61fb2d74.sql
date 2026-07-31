-- Money and operational schema hardening
-- 1) Adds wallet tables + secure RPCs used by edge functions
-- 2) Adds missing support tables referenced by the app
-- 3) Adds admin flag and helper policies

-- Extend transaction status for disputes if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'transaction_status'
      AND e.enumlabel = 'disputed'
  ) THEN
    ALTER TYPE public.transaction_status ADD VALUE 'disputed';
  END IF;
END $$;

-- Core missing columns referenced in code
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_team_task BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS team_size INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_team_size_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_team_size_check CHECK (team_size >= 1);

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS proposed_rate NUMERIC(12,2);

ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS id_upload_path TEXT;

-- Admin helper
CREATE OR REPLACE FUNCTION public.is_admin_user(_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = _uid AND p.is_admin = TRUE
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user(UUID) TO authenticated;

-- Wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_earned NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wallets_balance_nonnegative CHECK (balance >= 0),
  CONSTRAINT wallets_total_earned_nonnegative CHECK (total_earned >= 0),
  CONSTRAINT wallets_total_withdrawn_nonnegative CHECK (total_withdrawn >= 0)
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  description TEXT,
  reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS transactions_task_id_uniq
      ON public.transactions(task_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping transactions_task_id_uniq creation: %', SQLERRM;
  END;
END $$;

-- Normalize legacy references and de-duplicate before adding unique index.
UPDATE public.wallet_transactions
SET reference = NULL
WHERE reference IS NOT NULL
  AND btrim(reference) = '';

DO $$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_user_ref_type_uniq
      ON public.wallet_transactions(user_id, reference, transaction_type)
      WHERE reference IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping wallet_transactions_user_ref_type_uniq creation: %', SQLERRM;
  END;
END $$;

CREATE INDEX IF NOT EXISTS wallet_transactions_user_created_idx
  ON public.wallet_transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  paystack_recipient_code TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, bank_code, account_number)
);

CREATE TABLE IF NOT EXISTS public.wallet_funding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  paystack_reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  webhook_processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  fee NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  net_amount NUMERIC(14,2) NOT NULL CHECK (net_amount >= 0),
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  recipient_code TEXT,
  reference TEXT NOT NULL UNIQUE,
  paystack_transfer_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'reversed', 'rejected')),
  failure_reason TEXT,
  notes TEXT,
  webhook_processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS withdrawal_requests_user_created_idx
  ON public.withdrawal_requests(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.nigerian_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Minimal seed set; can be expanded later via admin script
INSERT INTO public.nigerian_banks(code, name, active) VALUES
  ('044', 'Access Bank', TRUE),
  ('063', 'Access Bank (Diamond)', TRUE),
  ('050', 'Ecobank Nigeria', TRUE),
  ('011', 'First Bank of Nigeria', TRUE),
  ('214', 'First City Monument Bank', TRUE),
  ('070', 'Fidelity Bank', TRUE),
  ('058', 'Guaranty Trust Bank', TRUE),
  ('030', 'Heritage Bank', TRUE),
  ('301', 'Jaiz Bank', TRUE),
  ('082', 'Keystone Bank', TRUE),
  ('526', 'Parallex Bank', TRUE),
  ('076', 'Polaris Bank', TRUE),
  ('101', 'Providus Bank', TRUE),
  ('125', 'Rubies Bank', TRUE),
  ('513', 'Stanbic IBTC Bank', TRUE),
  ('068', 'Standard Chartered Bank', TRUE),
  ('232', 'Sterling Bank', TRUE),
  ('100', 'Suntrust Bank', TRUE),
  ('032', 'Union Bank', TRUE),
  ('033', 'United Bank For Africa', TRUE),
  ('215', 'Unity Bank', TRUE),
  ('035', 'Wema Bank', TRUE),
  ('057', 'Zenith Bank', TRUE),
  ('090267', 'VFD Microfinance Bank', TRUE),
  ('090405', 'Moniepoint Microfinance Bank', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Support tables referenced by app
CREATE TABLE IF NOT EXISTS public.saved_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, task_id)
);

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  raised_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  resolution TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member')),
  payment_share NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.alumni_pro_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumni_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  paystack_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at triggers
DROP TRIGGER IF EXISTS wallets_updated ON public.wallets;
CREATE TRIGGER wallets_updated
BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS bank_accounts_updated ON public.bank_accounts;
CREATE TRIGGER bank_accounts_updated
BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS wallet_funding_updated ON public.wallet_funding;
CREATE TRIGGER wallet_funding_updated
BEFORE UPDATE ON public.wallet_funding
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS withdrawal_requests_updated ON public.withdrawal_requests;
CREATE TRIGGER withdrawal_requests_updated
BEFORE UPDATE ON public.withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS reports_updated ON public.reports;
CREATE TRIGGER reports_updated
BEFORE UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS disputes_updated ON public.disputes;
CREATE TRIGGER disputes_updated
BEFORE UPDATE ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS task_team_members_updated ON public.task_team_members;
CREATE TRIGGER task_team_members_updated
BEFORE UPDATE ON public.task_team_members
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS alumni_pro_subscriptions_updated ON public.alumni_pro_subscriptions;
CREATE TRIGGER alumni_pro_subscriptions_updated
BEFORE UPDATE ON public.alumni_pro_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Wallet RPCs
CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is required');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(COALESCE(p_reference, '')));

  IF p_reference IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    WHERE wt.user_id = p_user_id
      AND wt.reference = p_reference
      AND wt.transaction_type = 'credit'
  ) THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'wallet_id', v_wallet.id, 'balance', COALESCE(v_wallet.balance, 0));
  END IF;

  INSERT INTO public.wallets (user_id, balance, total_earned, total_withdrawn)
  VALUES (p_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.wallet_transactions(
    wallet_id,
    user_id,
    transaction_type,
    amount,
    status,
    description,
    reference
  )
  SELECT
    w.id,
    p_user_id,
    'credit',
    p_amount,
    'completed',
    COALESCE(p_description, 'Wallet credit'),
    p_reference
  FROM public.wallets w
  WHERE w.user_id = p_user_id
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_transaction_id;

  IF v_transaction_id IS NULL THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'wallet_id', v_wallet.id, 'balance', COALESCE(v_wallet.balance, 0));
  END IF;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  UPDATE public.wallets
  SET
    balance = v_wallet.balance + p_amount,
    total_earned = v_wallet.total_earned + p_amount
  WHERE id = v_wallet.id
  RETURNING balance INTO v_new_balance;

  RETURN jsonb_build_object('success', true, 'wallet_id', v_wallet.id, 'balance', v_new_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.debit_wallet_atomic(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_new_balance NUMERIC;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is required');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(COALESCE(p_reference, '')));

  IF p_reference IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    WHERE wt.user_id = p_user_id
      AND wt.reference = p_reference
      AND wt.transaction_type = 'debit'
  ) THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'wallet_id', v_wallet.id, 'balance', COALESCE(v_wallet.balance, 0));
  END IF;

  INSERT INTO public.wallets (user_id, balance, total_earned, total_withdrawn)
  VALUES (p_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE public.wallets
  SET
    balance = v_wallet.balance - p_amount,
    total_withdrawn = v_wallet.total_withdrawn + p_amount
  WHERE id = v_wallet.id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.wallet_transactions(
    wallet_id,
    user_id,
    transaction_type,
    amount,
    status,
    description,
    reference
  ) VALUES (
    v_wallet.id,
    p_user_id,
    'debit',
    p_amount,
    'pending',
    COALESCE(p_description, 'Wallet debit'),
    p_reference
  );

  RETURN jsonb_build_object('success', true, 'wallet_id', v_wallet.id, 'balance', v_new_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_wallet_debit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_new_balance NUMERIC;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is required');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(COALESCE(p_reference, '')));

  IF p_reference IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    WHERE wt.user_id = p_user_id
      AND wt.reference = p_reference
      AND wt.transaction_type = 'credit'
  ) THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'wallet_id', v_wallet.id, 'balance', COALESCE(v_wallet.balance, 0));
  END IF;

  INSERT INTO public.wallets (user_id, balance, total_earned, total_withdrawn)
  VALUES (p_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  UPDATE public.wallets
  SET
    balance = v_wallet.balance + p_amount,
    total_withdrawn = GREATEST(0, v_wallet.total_withdrawn - p_amount)
  WHERE id = v_wallet.id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.wallet_transactions(
    wallet_id,
    user_id,
    transaction_type,
    amount,
    status,
    description,
    reference
  ) VALUES (
    v_wallet.id,
    p_user_id,
    'credit',
    p_amount,
    'completed',
    COALESCE(p_description, 'Wallet debit reversal'),
    p_reference
  )
  ON CONFLICT DO NOTHING;

  UPDATE public.wallet_transactions
  SET status = 'reversed'
  WHERE user_id = p_user_id
    AND transaction_type = 'debit'
    AND reference = p_reference;

  RETURN jsonb_build_object('success', true, 'wallet_id', v_wallet.id, 'balance', v_new_balance);
END;
$$;

-- Prevent direct client execution of wallet mutators
REVOKE EXECUTE ON FUNCTION public.credit_wallet(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_wallet_atomic(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reverse_wallet_debit(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.credit_wallet(UUID, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.debit_wallet_atomic(UUID, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_wallet_debit(UUID, NUMERIC, TEXT, TEXT) TO service_role;

-- Public-safe counter RPC used by task details
CREATE OR REPLACE FUNCTION public.increment_task_views(task_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tasks
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = task_uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_task_views(UUID) TO authenticated, anon;

-- RLS + grants
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_funding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nigerian_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni_pro_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet owner read" ON public.wallets;
CREATE POLICY "wallet owner read" ON public.wallets
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "wallet owner upsert" ON public.wallets;
CREATE POLICY "wallet owner upsert" ON public.wallets
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "wallet owner update" ON public.wallets;
CREATE POLICY "wallet owner update" ON public.wallets
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "wallet tx owner read" ON public.wallet_transactions;
CREATE POLICY "wallet tx owner read" ON public.wallet_transactions
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "wallet tx admin update" ON public.wallet_transactions;
CREATE POLICY "wallet tx admin update" ON public.wallet_transactions
FOR UPDATE TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "wallet funding owner read" ON public.wallet_funding;
CREATE POLICY "wallet funding owner read" ON public.wallet_funding
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "withdrawal owner read" ON public.withdrawal_requests;
CREATE POLICY "withdrawal owner read" ON public.withdrawal_requests
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "withdrawal owner insert" ON public.withdrawal_requests;
CREATE POLICY "withdrawal owner insert" ON public.withdrawal_requests
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "withdrawal admin update" ON public.withdrawal_requests;
CREATE POLICY "withdrawal admin update" ON public.withdrawal_requests
FOR UPDATE TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "bank account owner select" ON public.bank_accounts;
CREATE POLICY "bank account owner select" ON public.bank_accounts
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "bank account owner insert" ON public.bank_accounts;
CREATE POLICY "bank account owner insert" ON public.bank_accounts
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bank account owner update" ON public.bank_accounts;
CREATE POLICY "bank account owner update" ON public.bank_accounts
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "bank account owner delete" ON public.bank_accounts;
CREATE POLICY "bank account owner delete" ON public.bank_accounts
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "nigerian banks readable" ON public.nigerian_banks;
CREATE POLICY "nigerian banks readable" ON public.nigerian_banks
FOR SELECT TO authenticated, anon
USING (active = TRUE);

DROP POLICY IF EXISTS "saved tasks owner all" ON public.saved_tasks;
CREATE POLICY "saved tasks owner all" ON public.saved_tasks
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reports reporter read" ON public.reports;
CREATE POLICY "reports reporter read" ON public.reports
FOR SELECT TO authenticated
USING (auth.uid() = reporter_id OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "reports reporter insert" ON public.reports;
CREATE POLICY "reports reporter insert" ON public.reports
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports admin update" ON public.reports;
CREATE POLICY "reports admin update" ON public.reports
FOR UPDATE TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "disputes participants read" ON public.disputes;
CREATE POLICY "disputes participants read" ON public.disputes
FOR SELECT TO authenticated
USING (
  public.is_admin_user(auth.uid())
  OR auth.uid() = raised_by
  OR EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_id
      AND (t.poster_id = auth.uid() OR t.matched_student_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "disputes raiser insert" ON public.disputes;
CREATE POLICY "disputes raiser insert" ON public.disputes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = raised_by);

DROP POLICY IF EXISTS "disputes admin update" ON public.disputes;
CREATE POLICY "disputes admin update" ON public.disputes
FOR UPDATE TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "team members readable by participants" ON public.task_team_members;
CREATE POLICY "team members readable by participants" ON public.task_team_members
FOR SELECT TO authenticated
USING (
  public.is_admin_user(auth.uid())
  OR auth.uid() = student_id
  OR EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.poster_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "team members managed by poster" ON public.task_team_members;
CREATE POLICY "team members managed by poster" ON public.task_team_members
FOR ALL TO authenticated
USING (
  public.is_admin_user(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.poster_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin_user(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.poster_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "alumni pro own row" ON public.alumni_pro_subscriptions;
CREATE POLICY "alumni pro own row" ON public.alumni_pro_subscriptions
FOR ALL TO authenticated
USING (auth.uid() = alumni_id OR public.is_admin_user(auth.uid()))
WITH CHECK (auth.uid() = alumni_id OR public.is_admin_user(auth.uid()));

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.wallets TO authenticated;
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT SELECT ON public.wallet_funding TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.withdrawal_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT SELECT ON public.nigerian_banks TO authenticated, anon;
GRANT SELECT, INSERT, DELETE ON public.saved_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.disputes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.alumni_pro_subscriptions TO authenticated;

GRANT ALL ON public.wallets TO service_role;
GRANT ALL ON public.wallet_transactions TO service_role;
GRANT ALL ON public.wallet_funding TO service_role;
GRANT ALL ON public.withdrawal_requests TO service_role;
GRANT ALL ON public.bank_accounts TO service_role;
GRANT ALL ON public.nigerian_banks TO service_role;
GRANT ALL ON public.saved_tasks TO service_role;
GRANT ALL ON public.reports TO service_role;
GRANT ALL ON public.disputes TO service_role;
GRANT ALL ON public.task_team_members TO service_role;
GRANT ALL ON public.alumni_pro_subscriptions TO service_role;
