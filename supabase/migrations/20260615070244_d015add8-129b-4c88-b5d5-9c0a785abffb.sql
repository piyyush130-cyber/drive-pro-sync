
-- Extend lesson_types (services)
ALTER TABLE public.lesson_types
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'lesson',
  ADD COLUMN IF NOT EXISTS buffer_minutes integer NOT NULL DEFAULT 0;

-- Instructor recurring availability
CREATE TABLE IF NOT EXISTS public.instructor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  break_start time,
  break_end time,
  max_lessons_per_day integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_availability TO authenticated;
GRANT ALL ON public.instructor_availability TO service_role;
ALTER TABLE public.instructor_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_admin_all" ON public.instructor_availability FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ia_inst_read_own" ON public.instructor_availability FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.instructors i WHERE i.id = instructor_id AND i.profile_id = auth.uid()));
CREATE TRIGGER trg_ia_upd BEFORE UPDATE ON public.instructor_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Instructor blocked time
CREATE TABLE IF NOT EXISTS public.instructor_blocked_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_blocked_times TO authenticated;
GRANT ALL ON public.instructor_blocked_times TO service_role;
ALTER TABLE public.instructor_blocked_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ibt_admin_all" ON public.instructor_blocked_times FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ibt_inst_read_own" ON public.instructor_blocked_times FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.instructors i WHERE i.id = instructor_id AND i.profile_id = auth.uid()));
