-- MPI test location: different students may test at different MPI branches,
-- and the school needs to route from pickup to the specific office for that
-- booking — separate from the pickup address itself. School-configurable
-- list (dropdown) with a free-text fallback when no list is set, same
-- pattern as pickup_service_areas.
ALTER TABLE public.school_settings
  ADD COLUMN mpi_test_locations TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.bookings
  ADD COLUMN mpi_test_location TEXT;
