-- RLS audit findings (no active cross-school leak found — everything
-- sensitive is already gated by has_role_in_school() or by an
-- instructor-owns-this-row EXISTS check, both of which are inherently
-- school-scoped). Two hardening fixes:

-- 1. anon (the public/browser key) had broad raw GRANTs — INSERT,
-- UPDATE, DELETE, SELECT — on nearly every table, left over from an
-- earlier out-of-band "grant Data API access to all tables" change.
-- RLS already blocked anon from actually using most of this (no anon
-- policy exists for those operations on those tables), but the app
-- only ever needs anon to read the three public storefront tables —
-- everything else the public booking flow does goes through
-- submitPublicBooking/submitPublicCancellation using the service role.
-- Removing the unused grants means a future RLS mistake on one table
-- doesn't silently become a full read/write bypass for anon.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT ON public.schools TO anon;
GRANT SELECT ON public.school_settings TO anon;
GRANT SELECT ON public.lesson_types TO anon;

-- 2. students.s_inst_read mixed the old school-unaware has_role() with
-- a school-safe EXISTS check. Not currently exploitable (the EXISTS
-- clause is the real gate, and it can only match a booking within the
-- instructor's own school), but the outer check should use the
-- school-scoped helper for consistency with every other instructor
-- policy and as defense-in-depth if the EXISTS clause is ever loosened.
DROP POLICY IF EXISTS "s_inst_read" ON public.students;
CREATE POLICY "s_inst_read" ON public.students FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.bookings b JOIN public.instructors i ON i.id = b.instructor_id
    WHERE b.student_id = students.id AND i.profile_id = auth.uid()
      AND public.has_role_in_school(auth.uid(), i.school_id, 'instructor')
  )
);

-- 3. instructors had two identical policies (i_inst_read_own and
-- instructors_self_read, both profile_id = auth.uid()) from two
-- separate migrations. Drop the duplicate.
DROP POLICY IF EXISTS "instructors_self_read" ON public.instructors;
