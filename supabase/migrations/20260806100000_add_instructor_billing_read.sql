-- school_billing only had an admin-read RLS policy (sb_admin_read), but the
-- billing gate in _authenticated/route.tsx runs for every authenticated
-- role, not just admins — useSchoolBilling() is called regardless of role.
-- With no instructor-read policy, RLS silently returned zero rows for any
-- instructor (a real "no rows" result, not an error), which the gate reads
-- as "this school has no billing set up yet" and incorrectly shows the
-- "Choose a plan to continue" screen to every instructor at every school,
-- including ones that are fully paid and active.
DROP POLICY IF EXISTS "sb_instructor_read" ON public.school_billing;
CREATE POLICY "sb_instructor_read" ON public.school_billing FOR SELECT TO authenticated
  USING (public.has_role_in_school(auth.uid(), school_id, 'instructor'));
