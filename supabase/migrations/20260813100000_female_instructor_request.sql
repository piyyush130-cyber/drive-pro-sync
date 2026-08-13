-- Lets a student request a female instructor at booking time. Boolean, not
-- a fuller gender field — matches this schema's existing feature-flag
-- convention (mpi_permitted, pickup_available) and serves exactly the one
-- described use case rather than inventing a demographics taxonomy.
ALTER TABLE public.instructors
  ADD COLUMN is_female BOOLEAN NOT NULL DEFAULT false;

-- Persisted on the booking (not just consumed transiently at assignment
-- time) so the preference is never silently lost — if auto-assignment
-- can't find a qualifying instructor, the booking still lands unassigned,
-- but this flag makes that visibly distinct from an ordinary unassigned
-- booking to the admin reviewing the queue.
ALTER TABLE public.bookings
  ADD COLUMN female_instructor_requested BOOLEAN NOT NULL DEFAULT false;
