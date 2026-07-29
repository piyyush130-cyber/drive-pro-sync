-- Catch-up migration: multi-school support was added directly against the
-- production database via the SQL Editor and was never captured as a
-- tracked migration. This reconstructs that change so a fresh database
-- (local dev, a new environment) ends up schema-equivalent to production.
-- All statements are guarded so this is also safe to run against a
-- database that already has these objects.

CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.schools TO anon, authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sch_public_read" ON public.schools;
CREATE POLICY "sch_public_read" ON public.schools FOR SELECT TO anon, authenticated USING (true);

-- Per-school-scoped replacement for has_role()
CREATE OR REPLACE FUNCTION public.has_role_in_school(_user_id UUID, _school_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND school_id = _school_id
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_role_in_school(UUID, UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role_in_school(UUID, UUID, public.app_role) TO anon, authenticated, service_role;

-- user_roles: add school_id, replace unique(user_id, role) with unique(user_id, school_id, role)
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_school_role_key UNIQUE (user_id, school_id, role);
DROP POLICY IF EXISTS "ur_admin_read" ON public.user_roles;
DROP POLICY IF EXISTS ur_admin_insert ON public.user_roles;
DROP POLICY IF EXISTS ur_admin_update ON public.user_roles;
DROP POLICY IF EXISTS ur_admin_delete ON public.user_roles;
CREATE POLICY "ur_admin_read" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role_in_school(auth.uid(), school_id, 'admin'));
CREATE POLICY ur_admin_insert ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));
CREATE POLICY ur_admin_update ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role_in_school(auth.uid(), school_id, 'admin')) WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));
CREATE POLICY ur_admin_delete ON public.user_roles FOR DELETE TO authenticated USING (public.has_role_in_school(auth.uid(), school_id, 'admin'));

-- profiles: admin can read/update profiles of users who share a school with them
DROP POLICY IF EXISTS "p_admin_read" ON public.profiles;
DROP POLICY IF EXISTS "p_admin_update" ON public.profiles;
CREATE POLICY "p_admin_read" ON public.profiles FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles ur_me JOIN public.user_roles ur_them ON ur_them.school_id = ur_me.school_id
    WHERE ur_me.user_id = auth.uid() AND ur_me.role = 'admin' AND ur_them.user_id = profiles.id)
);
CREATE POLICY "p_admin_update" ON public.profiles FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles ur_me JOIN public.user_roles ur_them ON ur_them.school_id = ur_me.school_id
    WHERE ur_me.user_id = auth.uid() AND ur_me.role = 'admin' AND ur_them.user_id = profiles.id)
);

-- school_settings: add school_id (the singleton id=1 constraint is removed by a later migration)
ALTER TABLE public.school_settings ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.school_settings ALTER COLUMN school_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE public.school_settings ADD CONSTRAINT school_settings_school_id_key UNIQUE (school_id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DROP POLICY IF EXISTS "ss_admin_update" ON public.school_settings;
DROP POLICY IF EXISTS "ss_admin_insert" ON public.school_settings;
CREATE POLICY "ss_admin_update" ON public.school_settings FOR UPDATE TO authenticated USING (public.has_role_in_school(auth.uid(), school_id, 'admin'));
CREATE POLICY "ss_admin_insert" ON public.school_settings FOR INSERT TO authenticated WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));

-- lesson_types
ALTER TABLE public.lesson_types ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.lesson_types ALTER COLUMN school_id SET NOT NULL;
DROP POLICY IF EXISTS "lt_admin_all" ON public.lesson_types;
CREATE POLICY "lt_admin_all" ON public.lesson_types FOR ALL TO authenticated USING (public.has_role_in_school(auth.uid(), school_id, 'admin')) WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));

-- instructors
ALTER TABLE public.instructors ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.instructors ALTER COLUMN school_id SET NOT NULL;
DROP POLICY IF EXISTS "i_admin_all" ON public.instructors;
DROP POLICY IF EXISTS "i_inst_read" ON public.instructors;
CREATE POLICY "i_admin_all" ON public.instructors FOR ALL TO authenticated USING (public.has_role_in_school(auth.uid(), school_id, 'admin')) WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));
CREATE POLICY "i_inst_read" ON public.instructors FOR SELECT TO authenticated USING (public.has_role_in_school(auth.uid(), school_id, 'instructor'));

-- students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.students ALTER COLUMN school_id SET NOT NULL;
DROP POLICY IF EXISTS "s_admin_all" ON public.students;
CREATE POLICY "s_admin_all" ON public.students FOR ALL TO authenticated USING (public.has_role_in_school(auth.uid(), school_id, 'admin')) WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));

-- bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.bookings ALTER COLUMN school_id SET NOT NULL;
DROP POLICY IF EXISTS "b_admin_all" ON public.bookings;
CREATE POLICY "b_admin_all" ON public.bookings FOR ALL TO authenticated USING (public.has_role_in_school(auth.uid(), school_id, 'admin')) WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));

-- student_progress
ALTER TABLE public.student_progress ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.student_progress ALTER COLUMN school_id SET NOT NULL;
DROP POLICY IF EXISTS "sp_admin_all" ON public.student_progress;
CREATE POLICY "sp_admin_all" ON public.student_progress FOR ALL TO authenticated USING (public.has_role_in_school(auth.uid(), school_id, 'admin')) WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));

-- cancellation_requests
ALTER TABLE public.cancellation_requests ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.cancellation_requests ALTER COLUMN school_id SET NOT NULL;
DROP POLICY IF EXISTS "cr_admin_all" ON public.cancellation_requests;
CREATE POLICY "cr_admin_all" ON public.cancellation_requests FOR ALL TO authenticated USING (public.has_role_in_school(auth.uid(), school_id, 'admin')) WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));

-- instructor_availability
ALTER TABLE public.instructor_availability ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.instructor_availability ALTER COLUMN school_id SET NOT NULL;
DROP POLICY IF EXISTS "ia_admin_all" ON public.instructor_availability;
CREATE POLICY "ia_admin_all" ON public.instructor_availability FOR ALL TO authenticated USING (public.has_role_in_school(auth.uid(), school_id, 'admin')) WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));

-- instructor_blocked_times
ALTER TABLE public.instructor_blocked_times ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.instructor_blocked_times ALTER COLUMN school_id SET NOT NULL;
DROP POLICY IF EXISTS "ibt_admin_all" ON public.instructor_blocked_times;
CREATE POLICY "ibt_admin_all" ON public.instructor_blocked_times FOR ALL TO authenticated USING (public.has_role_in_school(auth.uid(), school_id, 'admin')) WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));

-- instructor_invite_codes
ALTER TABLE public.instructor_invite_codes ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.instructor_invite_codes ALTER COLUMN school_id SET NOT NULL;
DROP POLICY IF EXISTS iic_admin_all ON public.instructor_invite_codes;
CREATE POLICY iic_admin_all ON public.instructor_invite_codes FOR ALL TO authenticated USING (public.has_role_in_school(auth.uid(), school_id, 'admin')) WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));

-- lesson_notes
ALTER TABLE public.lesson_notes ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.lesson_notes ALTER COLUMN school_id SET NOT NULL;
DROP POLICY IF EXISTS "ln_admin_all" ON public.lesson_notes;
CREATE POLICY "ln_admin_all" ON public.lesson_notes FOR ALL TO authenticated USING (public.has_role_in_school(auth.uid(), school_id, 'admin')) WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));
