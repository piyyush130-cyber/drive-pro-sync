-- Waitlist: students who want the next available slot. When a future
-- booking is cancelled (or no-showed, though by definition that's almost
-- always already in the past), the freed instructor slot gets offered to
-- the longest-waiting eligible entry via a single-use claim link.
CREATE TABLE public.waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'claimed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.waitlist_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_entry_id UUID NOT NULL REFERENCES public.waitlist_entries(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES public.instructors(id) ON DELETE SET NULL,
  lesson_type_id UUID REFERENCES public.lesson_types(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_offers ENABLE ROW LEVEL SECURITY;

-- Admin manages entries directly (RLS-scoped client). Offers are only ever
-- written by the service role (offer creation + token-based claim), same
-- trust model as student_login_links; admins get read access for the
-- "recent offers" audit view on the waitlist page.
CREATE POLICY "we_admin_all" ON public.waitlist_entries FOR ALL TO authenticated
  USING (public.has_role_in_school(auth.uid(), school_id, 'admin'))
  WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));

CREATE POLICY "wo_admin_read" ON public.waitlist_offers FOR SELECT TO authenticated
  USING (public.has_role_in_school(auth.uid(), school_id, 'admin'));
