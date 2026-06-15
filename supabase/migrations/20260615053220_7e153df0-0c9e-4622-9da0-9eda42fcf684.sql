
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Tighten public insert policies (still permissive but require non-empty key fields)
DROP POLICY "s_public_insert" ON public.students;
CREATE POLICY "s_public_insert" ON public.students FOR INSERT TO anon, authenticated
  WITH CHECK (length(coalesce(full_name,'')) > 0 AND length(coalesce(phone,'')) > 0);

DROP POLICY "b_public_insert" ON public.bookings;
CREATE POLICY "b_public_insert" ON public.bookings FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending' AND length(coalesce(pickup_address,'')) > 0);

DROP POLICY "cr_public_insert" ON public.cancellation_requests;
CREATE POLICY "cr_public_insert" ON public.cancellation_requests FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'requested');
