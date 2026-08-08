-- Manitoba MPI Training Support Requirement (TSR) / retest package:
-- students who fail their road test 3 times must complete 5 hours of
-- documented instruction before rebooking, and the instructor must be able
-- to record that a verification form was issued once those hours are done.
-- Kept as its own small table (not folded into the general lesson-package
-- system) since this requirement is Manitoba-specific and may not carry
-- over as we expand to other provinces/states.
CREATE TABLE public.tsr_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  issued_by_instructor_id UUID REFERENCES public.instructors(id) ON DELETE SET NULL,
  hours_completed_at_issue NUMERIC NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tsr_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tv_admin_all" ON public.tsr_verifications FOR ALL TO authenticated
  USING (public.has_role_in_school(auth.uid(), school_id, 'admin'))
  WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));

-- Instructors can read and record verifications for students they teach —
-- mirrors the ln_inst_read / ln_inst_insert pattern on lesson_notes.
CREATE POLICY "tv_inst_read" ON public.tsr_verifications FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.instructors i ON i.id = b.instructor_id
    WHERE b.student_id = tsr_verifications.student_id AND i.profile_id = auth.uid()
  ));

CREATE POLICY "tv_inst_insert" ON public.tsr_verifications FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.instructors i
    WHERE i.id = tsr_verifications.issued_by_instructor_id AND i.profile_id = auth.uid()
  ));

-- Recorded acknowledgment for liability purposes, not a feature gate —
-- every MB school is already legally required to hold an MPI permit.
ALTER TABLE public.school_settings
  ADD COLUMN mpi_permit_confirmed_at TIMESTAMPTZ;
