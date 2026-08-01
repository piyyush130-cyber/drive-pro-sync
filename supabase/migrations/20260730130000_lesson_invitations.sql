CREATE TYPE public.invitation_status AS ENUM ('sent', 'reminded', 'booked', 'expired');

CREATE TABLE public.lesson_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status public.invitation_status NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminder_sent_at TIMESTAMPTZ,
  booked_at TIMESTAMPTZ,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_li_student ON public.lesson_invitations(student_id);
CREATE INDEX idx_li_school ON public.lesson_invitations(school_id);
CREATE INDEX idx_li_status ON public.lesson_invitations(status);
CREATE INDEX idx_li_token ON public.lesson_invitations(token);

GRANT SELECT, INSERT, UPDATE ON public.lesson_invitations TO authenticated;
GRANT ALL ON public.lesson_invitations TO service_role;
ALTER TABLE public.lesson_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "li_admin_all" ON public.lesson_invitations FOR ALL TO authenticated
  USING (public.has_role_in_school(auth.uid(), school_id, 'admin'))
  WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));

-- Per-school toggle for automatic invitations. Manual send/resend from the
-- student profile always works regardless of this setting.
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS auto_invitations_enabled BOOLEAN NOT NULL DEFAULT false;
