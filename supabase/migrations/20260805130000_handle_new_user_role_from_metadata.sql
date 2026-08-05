-- Ensure signup role is set at profile creation time.
-- This avoids role updates after insert, which are restricted to admins.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role public.user_role;
BEGIN
  requested_role := CASE COALESCE(NEW.raw_user_meta_data->>'role', '')
    WHEN 'student' THEN 'student'::public.user_role
    WHEN 'alumni' THEN 'alumni'::public.user_role
    WHEN 'company' THEN 'company'::public.user_role
    WHEN 'individual' THEN 'individual'::public.user_role
    ELSE 'student'::public.user_role
  END;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    requested_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
