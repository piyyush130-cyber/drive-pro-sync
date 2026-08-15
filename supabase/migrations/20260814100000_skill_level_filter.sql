ALTER TABLE public.school_settings
  ADD COLUMN skill_level_filter_enabled BOOLEAN NOT NULL DEFAULT false;

-- Multi-select tags an admin assigns to a lesson type (e.g. a package can
-- apply to both "new_driver" and "some_experience"). NULL/empty means
-- untagged, which the booking-page filter always shows regardless of which
-- button is active — fail open, never hide a package just because nobody
-- got around to tagging it.
ALTER TABLE public.lesson_types
  ADD COLUMN skill_levels TEXT[] NOT NULL DEFAULT '{}';
