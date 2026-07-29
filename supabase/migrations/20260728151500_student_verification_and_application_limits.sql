-- Student email verification backing store + application limit enforcement.

-- Ensure Alumni Pro table exists for limit checks.
CREATE TABLE IF NOT EXISTS public.alumni_pro_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumni_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  paystack_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Used by edge functions to hold temporary verification codes.
CREATE TABLE IF NOT EXISTS public.student_email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  university_email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  code_expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS student_email_verifications_user_idx
  ON public.student_email_verifications(user_id);

ALTER TABLE public.student_email_verifications ENABLE ROW LEVEL SECURITY;

-- No client-side table access. Edge functions use service_role.
REVOKE ALL ON TABLE public.student_email_verifications FROM anon, authenticated;
GRANT ALL ON TABLE public.student_email_verifications TO service_role;

DROP TRIGGER IF EXISTS student_email_verifications_updated ON public.student_email_verifications;
CREATE TRIGGER student_email_verifications_updated
BEFORE UPDATE ON public.student_email_verifications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.application_limit_for_student(_student_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_active_pro BOOLEAN;
BEGIN
  IF _student_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.alumni_pro_subscriptions aps
    WHERE aps.alumni_id = _student_id
      AND aps.status = 'active'
      AND (aps.expires_at IS NULL OR aps.expires_at > now())
  ) INTO has_active_pro;

  IF has_active_pro THEN
    RETURN 2147483647;
  END IF;

  -- Free tier cap. Keep in sync with product messaging.
  RETURN 5;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_submit_task_application(_student_id UUID, _task_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_pending INTEGER;
  max_allowed INTEGER;
BEGIN
  IF _student_id IS NULL OR _task_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Must target an open task not owned by the applicant.
  IF NOT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = _task_id
      AND t.status = 'open'
      AND t.poster_id <> _student_id
  ) THEN
    RETURN FALSE;
  END IF;

  max_allowed := public.application_limit_for_student(_student_id);
  IF max_allowed >= 2147483647 THEN
    RETURN TRUE;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO current_pending
  FROM public.applications a
  JOIN public.tasks t ON t.id = a.task_id
  WHERE a.student_id = _student_id
    AND a.status = 'pending'
    AND t.status IN ('open', 'matched', 'in_progress', 'in_review');

  RETURN current_pending < max_allowed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.application_limit_for_student(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_submit_task_application(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.application_limit_for_student(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_submit_task_application(UUID, UUID) TO service_role;

-- Replace insert policy with capped version.
DROP POLICY IF EXISTS "students apply" ON public.applications;
DROP POLICY IF EXISTS "Students can insert own applications" ON public.applications;

CREATE POLICY "Students can insert own applications"
  ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND public.can_submit_task_application(student_id, task_id)
  );
