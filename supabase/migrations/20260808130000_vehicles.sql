-- Vehicles as a bookable resource, so admins assigning a car to a lesson
-- (especially road tests, where the specific dual-control vehicle matters)
-- can see conflicts instead of silently double-booking the same car.
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  plate TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v_admin_all" ON public.vehicles FOR ALL TO authenticated
  USING (public.has_role_in_school(auth.uid(), school_id, 'admin'))
  WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));

CREATE POLICY "v_inst_read" ON public.vehicles FOR SELECT TO authenticated
  USING (public.has_role_in_school(auth.uid(), school_id, 'instructor'));

ALTER TABLE public.bookings
  ADD COLUMN vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL;
