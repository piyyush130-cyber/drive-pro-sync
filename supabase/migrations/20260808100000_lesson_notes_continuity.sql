-- Instructor continuity: lesson_notes was previously scoped to "only the
-- instructor who wrote it" for every operation (ln_instructor_own, FOR
-- ALL), so when a student got reassigned to a different instructor
-- (unavailability, offboarding, etc.), the new instructor had no visibility
-- into prior lesson notes at all. Split into a broad SELECT (any instructor
-- who has ever had a booking with that student — mirrors student_progress's
-- existing sp_inst_read/insert/update pattern exactly) and narrow write
-- policies (only the original author can edit/delete their own notes).
DROP POLICY IF EXISTS "ln_instructor_own" ON public.lesson_notes;

CREATE POLICY "ln_inst_read" ON public.lesson_notes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.instructors i ON i.id = b.instructor_id
    WHERE b.student_id = lesson_notes.student_id AND i.profile_id = auth.uid()
  ));

CREATE POLICY "ln_inst_insert" ON public.lesson_notes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.instructors i
    WHERE i.id = lesson_notes.instructor_id AND i.profile_id = auth.uid()
  ));

CREATE POLICY "ln_inst_update" ON public.lesson_notes FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.instructors i
    WHERE i.id = lesson_notes.instructor_id AND i.profile_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.instructors i
    WHERE i.id = lesson_notes.instructor_id AND i.profile_id = auth.uid()
  ));

CREATE POLICY "ln_inst_delete" ON public.lesson_notes FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.instructors i
    WHERE i.id = lesson_notes.instructor_id AND i.profile_id = auth.uid()
  ));
