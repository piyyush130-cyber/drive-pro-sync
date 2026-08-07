-- School-level "fully booked" toggle: lets an admin pause all new bookings
-- (public page, invite-link, and student portal) without touching every
-- individual instructor's availability.
ALTER TABLE public.school_settings
  ADD COLUMN booking_paused BOOLEAN NOT NULL DEFAULT false;
