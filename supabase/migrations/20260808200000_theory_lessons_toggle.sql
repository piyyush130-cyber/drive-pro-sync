-- School-level toggle for theory/classroom lessons. When off, theory-
-- category lesson types stay in the database (so nothing is destroyed if
-- an admin re-enables it later) but are filtered out of every customer-
-- facing lesson-type list.
ALTER TABLE public.school_settings
  ADD COLUMN theory_lessons_enabled BOOLEAN NOT NULL DEFAULT false;
