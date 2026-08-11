-- Whether a school offers vehicle rental/use at all. Defaults to true —
-- Road Test packages already assume school-vehicle use today for every
-- existing school, so this toggle must not retroactively hide anything
-- schools are already relying on. When off, road_test and the new
-- car_rental category disappear from Services and every customer-facing
-- booking flow, same pattern as theory_lessons_enabled.
ALTER TABLE public.school_settings
  ADD COLUMN vehicle_rental_enabled BOOLEAN NOT NULL DEFAULT true;
