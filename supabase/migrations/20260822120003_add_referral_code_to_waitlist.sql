-- Add unique referral code column to waitlist
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Create index for fast referral lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_referral_code ON public.waitlist (referral_code);
