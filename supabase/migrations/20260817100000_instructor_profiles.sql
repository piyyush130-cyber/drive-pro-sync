-- All optional/nullable — an instructor's profile card gracefully falls
-- back (initials instead of photo, badges/vehicle row simply omitted) when
-- these are unset, rather than requiring schools to fill them in.
ALTER TABLE public.instructors
  ADD COLUMN photo_url TEXT,
  ADD COLUMN bio TEXT,
  ADD COLUMN badges TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN vehicle_make TEXT,
  ADD COLUMN vehicle_model TEXT,
  ADD COLUMN vehicle_year INTEGER;

ALTER TABLE public.school_settings
  ADD COLUMN instructor_selection_enabled BOOLEAN NOT NULL DEFAULT false;
