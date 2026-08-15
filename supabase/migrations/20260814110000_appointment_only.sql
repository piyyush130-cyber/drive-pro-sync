-- Presence-based, not a toggle: an empty table means zero behavior change
-- for schools that never touch this feature. instructor_id NULL means the
-- override applies school-wide for that date; a specific instructor_id
-- blocks just that instructor from auto-assignment that date.
CREATE TABLE public.schedule_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES public.instructors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, instructor_id, date)
);

ALTER TABLE public.schedule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY so_admin_all ON public.schedule_overrides
  FOR ALL
  USING (has_role_in_school(auth.uid(), school_id, 'admin'))
  WITH CHECK (has_role_in_school(auth.uid(), school_id, 'admin'));

-- No anon/public read policy: the booking pages get appointment-only dates
-- through server functions (getAppointmentOnlyDates, getPortalBookingOptions,
-- getInvitationForToken) using supabaseAdmin, same reasoning as instructors
-- having no anon-read policy — no need to expose this table directly.

CREATE TABLE public.appointment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  preferred_date DATE,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY ar_admin_all ON public.appointment_requests
  FOR ALL
  USING (has_role_in_school(auth.uid(), school_id, 'admin'))
  WITH CHECK (has_role_in_school(auth.uid(), school_id, 'admin'));
