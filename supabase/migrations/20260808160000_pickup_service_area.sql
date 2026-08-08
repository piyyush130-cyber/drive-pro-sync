-- Pickup service-area restriction: schools can list the Forward Sortation
-- Areas (postal code prefixes, e.g. R2C) they're willing to drive to.
-- Empty array (the default) means no restriction — every existing school
-- is unaffected until they opt in by configuring a list.
ALTER TABLE public.school_settings
  ADD COLUMN pickup_service_areas TEXT[] NOT NULL DEFAULT '{}';

-- Per-lesson-type pickup toggle: some lesson types (e.g. road test
-- packages) may require in-person pickup at the school's location instead
-- of a drive-to-you service.
ALTER TABLE public.lesson_types
  ADD COLUMN pickup_available BOOLEAN NOT NULL DEFAULT true;
