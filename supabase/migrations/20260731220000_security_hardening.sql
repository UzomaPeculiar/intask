-- Security hardening
-- 1) Prevent non-admins from mutating privileged identity/verification fields
-- 2) Require the audit helper to be called by the actual admin user
-- 3) Keep service_role and admin UI flows working as-is

CREATE OR REPLACE FUNCTION public.prevent_non_admin_privileged_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR public.is_admin_user(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'profiles' THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'Only admins can change account roles';
    END IF;
  ELSIF TG_TABLE_NAME = 'student_profiles' THEN
    IF NEW.verified IS DISTINCT FROM OLD.verified
      OR NEW.verification_method IS DISTINCT FROM OLD.verification_method
      OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
      OR NEW.university_email IS DISTINCT FROM OLD.university_email
      OR NEW.id_upload_path IS DISTINCT FROM OLD.id_upload_path THEN
      RAISE EXCEPTION 'Only admins can change student verification fields';
    END IF;
  ELSIF TG_TABLE_NAME = 'company_profiles' THEN
    IF NEW.verified IS DISTINCT FROM OLD.verified
      OR NEW.verification_method IS DISTINCT FROM OLD.verification_method
      OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
      OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
      OR NEW.company_email IS DISTINCT FROM OLD.company_email
      OR NEW.cac_number IS DISTINCT FROM OLD.cac_number
      OR NEW.verification_doc_url IS DISTINCT FROM OLD.verification_doc_url THEN
      RAISE EXCEPTION 'Only admins can change company verification fields';
    END IF;
  ELSIF TG_TABLE_NAME = 'individual_profiles' THEN
    IF NEW.verified IS DISTINCT FROM OLD.verified
      OR NEW.verification_method IS DISTINCT FROM OLD.verification_method
      OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
      OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
      OR NEW.id_type IS DISTINCT FROM OLD.id_type
      OR NEW.id_upload_path IS DISTINCT FROM OLD.id_upload_path THEN
      RAISE EXCEPTION 'Only admins can change individual verification fields';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_non_admin_profile_updates ON public.profiles;
CREATE TRIGGER prevent_non_admin_profile_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_admin_privileged_profile_updates();

DROP TRIGGER IF EXISTS prevent_non_admin_student_profile_updates ON public.student_profiles;
CREATE TRIGGER prevent_non_admin_student_profile_updates
BEFORE UPDATE ON public.student_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_admin_privileged_profile_updates();

DROP TRIGGER IF EXISTS prevent_non_admin_company_profile_updates ON public.company_profiles;
CREATE TRIGGER prevent_non_admin_company_profile_updates
BEFORE UPDATE ON public.company_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_admin_privileged_profile_updates();

DROP TRIGGER IF EXISTS prevent_non_admin_individual_profile_updates ON public.individual_profiles;
CREATE TRIGGER prevent_non_admin_individual_profile_updates
BEFORE UPDATE ON public.individual_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_admin_privileged_profile_updates();

CREATE OR REPLACE FUNCTION public.log_admin_action(
  _admin_id UUID,
  _action TEXT,
  _target_type TEXT,
  _target_id TEXT DEFAULT NULL,
  _details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  IF _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Admin id must match the caller';
  END IF;

  INSERT INTO public.audit_log (admin_user_id, action, target_type, target_id, details)
  VALUES (_admin_id, _action, _target_type, _target_id, _details)
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;