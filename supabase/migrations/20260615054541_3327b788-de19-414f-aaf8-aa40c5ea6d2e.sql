
-- Tighten instructor self-read: only own record
DROP POLICY IF EXISTS "i_inst_read" ON public.instructors;
CREATE POLICY "i_inst_read_own" ON public.instructors
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- Remove public/anon insert policies; submissions go through a server function using service role
DROP POLICY IF EXISTS "s_public_insert" ON public.students;
DROP POLICY IF EXISTS "b_public_insert" ON public.bookings;
DROP POLICY IF EXISTS "cr_public_insert" ON public.cancellation_requests;

-- Lock down has_role: only used inside RLS / SECURITY DEFINER contexts
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
