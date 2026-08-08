-- Conflict checks for instructor/vehicle double-booking were previously
-- application-level only (SELECT same-day bookings, compute in JS, then
-- INSERT/UPDATE) — a genuine TOCTOU race: two concurrent requests can both
-- read "no conflict" and both writes succeed, silently double-booking with
-- no error to either side. This also meant the admin's manual instructor
-- reassignment dropdown had zero conflict checking at all, race or not.
--
-- Fix: a real EXCLUDE constraint makes overlap physically impossible
-- regardless of timing, for every current and future write path uniformly.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Can't be a GENERATED column: timestamptz + interval is timezone-dependent
-- (Postgres marks it STABLE, not IMMUTABLE, since DST transitions can
-- change the result), which generated-column expressions don't allow. A
-- trigger has no such restriction and gives the same always-in-sync effect.
ALTER TABLE public.bookings ADD COLUMN scheduled_range tstzrange;

CREATE OR REPLACE FUNCTION public.set_booking_scheduled_range()
RETURNS TRIGGER AS $$
BEGIN
  NEW.scheduled_range := tstzrange(
    NEW.scheduled_at,
    NEW.scheduled_at + (NEW.duration_minutes * interval '1 minute')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_booking_scheduled_range
  BEFORE INSERT OR UPDATE OF scheduled_at, duration_minutes ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_scheduled_range();

-- Backfill existing rows (the trigger only fires on future writes).
UPDATE public.bookings
  SET scheduled_range = tstzrange(scheduled_at, scheduled_at + (duration_minutes * interval '1 minute'));

ALTER TABLE public.bookings ALTER COLUMN scheduled_range SET NOT NULL;

-- Trigger-populated, never supplied by callers — this default exists only
-- so the generated TypeScript types mark the column optional on insert
-- (matching how every insert call site already works); the trigger always
-- overwrites it before the row is stored.
ALTER TABLE public.bookings ALTER COLUMN scheduled_range SET DEFAULT tstzrange(now(), now());

-- Scoped to the same statuses the app's own conflict-check queries already
-- use (cancelled/declined bookings don't occupy the slot); completed/
-- no_show bookings are always past-dated in practice but are still
-- included since they did occupy the resource at the time.
ALTER TABLE public.bookings
  ADD CONSTRAINT no_overlapping_instructor_bookings
  EXCLUDE USING gist (instructor_id WITH =, scheduled_range WITH &&)
  WHERE (status NOT IN ('cancelled', 'declined') AND deleted_at IS NULL AND instructor_id IS NOT NULL);

ALTER TABLE public.bookings
  ADD CONSTRAINT no_overlapping_vehicle_bookings
  EXCLUDE USING gist (vehicle_id WITH =, scheduled_range WITH &&)
  WHERE (status NOT IN ('cancelled', 'declined') AND deleted_at IS NULL AND vehicle_id IS NOT NULL);
