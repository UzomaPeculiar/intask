-- Track OTP send rate limits for verification email edge functions.

ALTER TABLE public.student_email_verifications
  ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sends_in_hour INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS send_hour_started_at TIMESTAMPTZ;

ALTER TABLE public.company_email_verifications
  ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sends_in_hour INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS send_hour_started_at TIMESTAMPTZ;
