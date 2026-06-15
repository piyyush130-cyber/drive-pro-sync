
CREATE TYPE public.app_role AS ENUM ('admin', 'instructor', 'student');
CREATE TYPE public.booking_status AS ENUM ('pending','confirmed','declined','rescheduled','cancelled','completed','no_show');
CREATE TYPE public.payment_status AS ENUM ('unpaid','deposit_paid','paid','refunded');
CREATE TYPE public.payment_method AS ENUM ('cash','etransfer','card','other');
CREATE TYPE public.cancel_status AS ENUM ('requested','approved','rejected');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, email TEXT, phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "p_read_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "p_admin_read" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "p_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "p_admin_update" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "ur_read_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ur_admin_read" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- school_settings
CREATE TABLE public.school_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  school_name TEXT NOT NULL DEFAULT 'My Driving School',
  logo_url TEXT, contact_phone TEXT, contact_email TEXT,
  service_area TEXT, cancellation_policy TEXT,
  default_duration_minutes INT NOT NULL DEFAULT 60,
  default_buffer_minutes INT NOT NULL DEFAULT 15,
  require_approval BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.school_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.school_settings TO authenticated;
GRANT ALL ON public.school_settings TO service_role;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_public_read" ON public.school_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ss_admin_update" ON public.school_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "ss_admin_insert" ON public.school_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_ss_upd BEFORE UPDATE ON public.school_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- lesson_types
CREATE TABLE public.lesson_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT,
  duration_minutes INT NOT NULL DEFAULT 60,
  price_cents INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lesson_types TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lesson_types TO authenticated;
GRANT ALL ON public.lesson_types TO service_role;
ALTER TABLE public.lesson_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lt_public_read" ON public.lesson_types FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lt_admin_all" ON public.lesson_types FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- instructors
CREATE TABLE public.instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL, email TEXT, phone TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_availability JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructors TO authenticated;
GRANT ALL ON public.instructors TO service_role;
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "i_admin_all" ON public.instructors FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "i_inst_read" ON public.instructors FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'instructor'));
CREATE TRIGGER trg_i_upd BEFORE UPDATE ON public.instructors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- students
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL, email TEXT, phone TEXT,
  pickup_address TEXT, notes TEXT, road_test_notes TEXT,
  lessons_purchased INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT INSERT ON public.students TO anon;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "s_admin_all" ON public.students FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "s_public_insert" ON public.students FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE TRIGGER trg_s_upd BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES public.instructors(id) ON DELETE SET NULL,
  lesson_type_id UUID REFERENCES public.lesson_types(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  pickup_address TEXT, dropoff_address TEXT,
  notes TEXT, admin_notes TEXT, lesson_notes TEXT,
  status public.booking_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  price_cents INT NOT NULL DEFAULT 0,
  payment_method public.payment_method,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_b_sched ON public.bookings(scheduled_at);
CREATE INDEX idx_b_status ON public.bookings(status);
CREATE INDEX idx_b_inst ON public.bookings(instructor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT INSERT ON public.bookings TO anon;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "b_admin_all" ON public.bookings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "b_public_insert" ON public.bookings FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending');
CREATE POLICY "b_inst_read" ON public.bookings FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.instructors i WHERE i.id = bookings.instructor_id AND i.profile_id = auth.uid())
);
CREATE POLICY "b_inst_update" ON public.bookings FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.instructors i WHERE i.id = bookings.instructor_id AND i.profile_id = auth.uid())
);
CREATE TRIGGER trg_b_upd BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- now safe to add instructor->students cross policy
CREATE POLICY "s_inst_read" ON public.students FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'instructor') AND EXISTS (
    SELECT 1 FROM public.bookings b JOIN public.instructors i ON i.id = b.instructor_id
    WHERE b.student_id = students.id AND i.profile_id = auth.uid()
  )
);

-- student_progress
CREATE TABLE public.student_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
  skills JSONB NOT NULL DEFAULT '{}'::jsonb,
  general_notes TEXT,
  road_test_ready BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_progress TO authenticated;
GRANT ALL ON public.student_progress TO service_role;
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sp_admin_all" ON public.student_progress FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "sp_inst_all" ON public.student_progress FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.bookings b JOIN public.instructors i ON i.id = b.instructor_id
    WHERE b.student_id = student_progress.student_id AND i.profile_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.bookings b JOIN public.instructors i ON i.id = b.instructor_id
    WHERE b.student_id = student_progress.student_id AND i.profile_id = auth.uid())
);
CREATE TRIGGER trg_sp_upd BEFORE UPDATE ON public.student_progress FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- cancellation_requests
CREATE TABLE public.cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  reason TEXT,
  status public.cancel_status NOT NULL DEFAULT 'requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cancellation_requests TO authenticated;
GRANT INSERT ON public.cancellation_requests TO anon;
GRANT ALL ON public.cancellation_requests TO service_role;
ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cr_admin_all" ON public.cancellation_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "cr_public_insert" ON public.cancellation_requests FOR INSERT TO anon, authenticated WITH CHECK (true);

-- seed defaults
INSERT INTO public.school_settings (id, school_name, contact_phone, contact_email, service_area, cancellation_policy)
VALUES (1, 'Standard Driving School', '(555) 123-4567', 'hello@drivingschool.example', 'Greater metro area, within 15km of city center.', '24 hours notice required for cancellations or rescheduling.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lesson_types (name, description, duration_minutes, price_cents, sort_order) VALUES
  ('1 Hour Driving Lesson','Standard single hour behind the wheel.', 60, 6500, 1),
  ('1.5 Hour Driving Lesson','Extended session for steady progress.', 90, 9500, 2),
  ('2 Hour Driving Lesson','Double session — most popular.', 120, 12000, 3),
  ('Road Test Package','Warm-up lesson plus car rental for the road test.', 90, 18000, 4),
  ('Custom Package','Tell us what you need.', 60, 0, 5);
