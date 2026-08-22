-- Waitlist table for email capture on the landing page
-- Stores emails from the /waitlist page with optional referral tracking

CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast email lookups (upsert on submit)
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist (email);

-- RLS: anyone can insert (public page), only authenticated can read
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (the waitlist page is public)
CREATE POLICY "Allow anonymous inserts"
  ON public.waitlist
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated inserts too
CREATE POLICY "Allow authenticated inserts"
  ON public.waitlist
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to read (for admin/count purposes)
CREATE POLICY "Allow authenticated read"
  ON public.waitlist
  FOR SELECT
  TO authenticated
  USING (true);

-- Grant permissions
GRANT INSERT ON TABLE public.waitlist TO anon;
GRANT INSERT ON TABLE public.waitlist TO authenticated;
GRANT SELECT ON TABLE public.waitlist TO authenticated;
