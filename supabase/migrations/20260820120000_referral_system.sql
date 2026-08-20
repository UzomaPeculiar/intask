-- =====================================================
-- Referral / Invite System
-- =====================================================
-- Each user gets a unique referral code.
-- When a new user signs up with a code, both the referrer
-- and the referred user receive wallet credit.

-- Referral codes: one per user, unique, 8-char alphanumeric.
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  code       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);

-- Referral events: tracks who referred whom and whether credit was issued.
CREATE TABLE IF NOT EXISTS public.referral_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id     UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code   TEXT NOT NULL,
  referrer_credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  referred_credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  credited        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_events_referrer ON public.referral_events(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_referred ON public.referral_events(referred_id);

-- Add referral tracking column to profiles.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);

-- Platform settings for referral reward amounts.
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'referral_rewards',
  '{"referrer_amount": 500, "referred_amount": 250}'::jsonb,
  'Wallet credit amounts (in Naira) for referral program: referrer_amount and referred_amount'
)
ON CONFLICT (key) DO NOTHING;

-- RLS: referral_codes
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referral code"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own referral code"
  ON public.referral_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS: referral_events
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrers can read own referral events"
  ON public.referral_events FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Referred users can read own referral event"
  ON public.referral_events FOR SELECT
  USING (auth.uid() = referred_id);

-- Allow service_role full access (needed by server functions).
GRANT ALL ON public.referral_codes TO service_role;
GRANT ALL ON public.referral_events TO service_role;
GRANT SELECT ON public.referral_codes TO authenticated;
GRANT SELECT ON public.referral_events TO authenticated;

-- Helper function: generate a random 8-char uppercase alphanumeric code.
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;
