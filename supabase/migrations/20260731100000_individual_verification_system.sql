-- Individual verification system
-- Tier 1: Auto-confirmed at signup (email + phone)
-- Tier 2: Optional government ID upload with admin review

-- Individual profiles table
CREATE TABLE IF NOT EXISTS public.individual_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  verified BOOLEAN NOT NULL DEFAULT TRUE, -- auto-confirmed at signup (email + phone)
  verification_method TEXT CHECK (verification_method IN ('id_upload', 'auto')),
  id_type TEXT CHECK (id_type IN ('NIN', 'voter_card', 'drivers_license', 'passport')),
  id_upload_path TEXT, -- path in storage bucket
  verification_status TEXT NOT NULL DEFAULT 'auto_verified', -- 'auto_verified', 'pending_review', 'approved', 'rejected'
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS individual_profiles_user_idx
  ON public.individual_profiles(user_id);

ALTER TABLE public.individual_profiles ENABLE ROW LEVEL SECURITY;

-- Owner can read and update their own profile
DROP POLICY IF EXISTS "Individual own profile read" ON public.individual_profiles;
CREATE POLICY "Individual own profile read" ON public.individual_profiles
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin_user());

DROP POLICY IF EXISTS "Individual own profile insert" ON public.individual_profiles;
CREATE POLICY "Individual own profile insert" ON public.individual_profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Individual own profile update" ON public.individual_profiles;
CREATE POLICY "Individual own profile update" ON public.individual_profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin_user())
WITH CHECK (auth.uid() = user_id OR public.is_admin_user());

GRANT SELECT, INSERT, UPDATE ON public.individual_profiles TO authenticated;
GRANT ALL ON public.individual_profiles TO service_role;

-- updated_at trigger
DROP TRIGGER IF EXISTS individual_profiles_updated ON public.individual_profiles;
CREATE TRIGGER individual_profiles_updated
BEFORE UPDATE ON public.individual_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket for individual documents (government IDs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('individual-docs', 'individual-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for individual documents
CREATE POLICY "Individual doc upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'individual-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Individual doc read own" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'individual-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admin read individual docs" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'individual-docs'
  AND public.is_admin_user()
);
