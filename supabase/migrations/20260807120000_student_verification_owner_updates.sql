-- Allow student owners to manage their own verification inputs without
-- weakening admin-only verification outcomes.

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
    IF OLD.verified IS TRUE AND (
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