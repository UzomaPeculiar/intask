-- Block privileged profile fields on INSERT, not just UPDATE.
-- RLS INSERT policies only enforce auth.uid() = id; upsert/insert paths must
-- not allow is_admin or verification escalation before a row exists.

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
    IF TG_OP = 'INSERT' THEN
      IF NEW.is_admin IS TRUE THEN
        RAISE EXCEPTION 'Only admins can set admin privileges';
      END IF;
      IF NEW.account_status IS NOT NULL AND NEW.account_status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'Only admins can set account status';
      END IF;
    ELSIF NEW.role IS DISTINCT FROM OLD.role OR NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'Only admins can change account roles';
    END IF;
  ELSIF TG_TABLE_NAME = 'student_profiles' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.verified IS TRUE THEN
        RAISE EXCEPTION 'Only admins can set student verification fields';
      END IF;
      IF NEW.verification_status IS NOT NULL AND NEW.verification_status IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'Only admins can set student verification fields';
      END IF;
    ELSIF OLD.verified IS TRUE AND (
      NEW.university_email IS DISTINCT FROM OLD.university_email
      OR NEW.verification_method IS DISTINCT FROM OLD.verification_method
      OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
      OR NEW.id_upload_path IS DISTINCT FROM OLD.id_upload_path
      OR NEW.verified IS DISTINCT FROM OLD.verified
      OR NEW.verification_doc_url IS DISTINCT FROM OLD.verification_doc_url
    ) THEN
      RAISE EXCEPTION 'Only admins can change student verification fields';
    ELSIF NEW.verified IS DISTINCT FROM OLD.verified
      OR (NEW.verification_status IS DISTINCT FROM OLD.verification_status AND NEW.verification_status IS DISTINCT FROM 'pending')
      OR NEW.verification_doc_url IS DISTINCT FROM OLD.verification_doc_url THEN
      RAISE EXCEPTION 'Only admins can change student verification fields';
    END IF;
  ELSIF TG_TABLE_NAME = 'company_profiles' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.verified IS TRUE THEN
        RAISE EXCEPTION 'Only admins can set company verification fields';
      END IF;
      IF NEW.verification_status IS NOT NULL AND NEW.verification_status IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'Only admins can set company verification fields';
      END IF;
    ELSIF NEW.verified IS DISTINCT FROM OLD.verified
      OR NEW.verification_method IS DISTINCT FROM OLD.verification_method
      OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
      OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
      OR NEW.company_email IS DISTINCT FROM OLD.company_email
      OR NEW.cac_number IS DISTINCT FROM OLD.cac_number
      OR NEW.verification_doc_url IS DISTINCT FROM OLD.verification_doc_url THEN
      RAISE EXCEPTION 'Only admins can change company verification fields';
    END IF;
  ELSIF TG_TABLE_NAME = 'individual_profiles' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.verification_status IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Only admins can set individual verification fields';
      END IF;
      IF NEW.verified IS TRUE AND NOT (
        NEW.verification_method = 'auto'
        AND NEW.verification_status = 'auto_verified'
      ) THEN
        RAISE EXCEPTION 'Only admins can set individual verification fields';
      END IF;
    ELSIF NEW.verified IS DISTINCT FROM OLD.verified
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

DROP TRIGGER IF EXISTS prevent_non_admin_profile_inserts ON public.profiles;
CREATE TRIGGER prevent_non_admin_profile_inserts
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_admin_privileged_profile_updates();

DROP TRIGGER IF EXISTS prevent_non_admin_student_profile_inserts ON public.student_profiles;
CREATE TRIGGER prevent_non_admin_student_profile_inserts
BEFORE INSERT ON public.student_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_admin_privileged_profile_updates();

DROP TRIGGER IF EXISTS prevent_non_admin_company_profile_inserts ON public.company_profiles;
CREATE TRIGGER prevent_non_admin_company_profile_inserts
BEFORE INSERT ON public.company_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_admin_privileged_profile_updates();

DROP TRIGGER IF EXISTS prevent_non_admin_individual_profile_inserts ON public.individual_profiles;
CREATE TRIGGER prevent_non_admin_individual_profile_inserts
BEFORE INSERT ON public.individual_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_admin_privileged_profile_updates();
