ALTER TABLE public.school_settings
  ADD COLUMN flexible_session_length_enabled BOOLEAN NOT NULL DEFAULT false;

-- Separate from lessons_purchased (which stays a lesson-count for schools
-- not using this feature) — a school with flexible sessions on tracks
-- package balance in hours instead, since a 10-hour package split into
-- 2x5hr sessions vs 10x1hr sessions has the same total hours but very
-- different lesson counts. NULL = no flexible-hours package purchased.
ALTER TABLE public.students
  ADD COLUMN package_hours_purchased NUMERIC(6, 2);
