
REVOKE EXECUTE ON FUNCTION public.get_my_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_email() TO authenticated;
