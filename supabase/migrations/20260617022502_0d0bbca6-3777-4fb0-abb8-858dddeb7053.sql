
CREATE TYPE public.road_test_readiness AS ENUM ('not_ready','improving','almost_ready','ready');

CREATE TABLE public.lesson_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  practiced_skills TEXT,
  next_focus TEXT,
  road_test_readiness public.road_test_readiness,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ln_booking ON public.lesson_notes(booking_id);
CREATE INDEX idx_ln_student ON public.lesson_notes(student_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_notes TO authenticated;
GRANT ALL ON public.lesson_notes TO service_role;

ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ln_admin_all" ON public.lesson_notes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "ln_instructor_own" ON public.lesson_notes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.instructors i WHERE i.id = lesson_notes.instructor_id AND i.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.instructors i WHERE i.id = lesson_notes.instructor_id AND i.profile_id = auth.uid()));

CREATE TRIGGER lesson_notes_updated_at BEFORE UPDATE ON public.lesson_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
