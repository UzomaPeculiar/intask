-- Company verification system
-- Adds email verification + CAC number + document upload support

-- Add verification columns to company_profiles
ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS verification_method TEXT CHECK (verification_method IN ('email', 'cac_number', 'document_upload')),
  ADD COLUMN IF NOT EXISTS company_email TEXT,
  ADD COLUMN IF NOT EXISTS cac_number TEXT,
  ADD COLUMN IF NOT EXISTS verification_doc_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Company email verifications table (mirrors student_email_verifications)
CREATE TABLE IF NOT EXISTS public.company_email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  code_expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_email_verifications_user_idx
  ON public.company_email_verifications(user_id);

ALTER TABLE public.company_email_verifications ENABLE ROW LEVEL SECURITY;

-- No client-side table access. Edge functions use service_role.
REVOKE ALL ON TABLE public.company_email_verifications FROM anon, authenticated;
GRANT ALL ON TABLE public.company_email_verifications TO service_role;

DROP TRIGGER IF EXISTS company_email_verifications_updated ON public.company_email_verifications;
CREATE TRIGGER company_email_verifications_updated
BEFORE UPDATE ON public.company_email_verifications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket for company documents (CAC certificates, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-docs', 'company-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for company documents
CREATE POLICY "Company doc upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Company doc read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admin read company docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-docs'
    AND public.is_admin_user()
  );
