-- school_settings was originally a single-row table (id INT PRIMARY KEY
-- CHECK (id = 1)). A later out-of-band migration added school_id for
-- multi-tenancy but left the id=1 constraint in place, which means the
-- table can still only ever hold one row total — every school after the
-- first fails to onboard. school_id is already NOT NULL UNIQUE, so promote
-- it to the real primary key and drop the legacy id column.

ALTER TABLE public.school_settings DROP CONSTRAINT IF EXISTS school_settings_id_check;
ALTER TABLE public.school_settings DROP CONSTRAINT IF EXISTS school_settings_pkey;
ALTER TABLE public.school_settings DROP CONSTRAINT IF EXISTS school_settings_school_id_key;
ALTER TABLE public.school_settings ADD PRIMARY KEY (school_id);
ALTER TABLE public.school_settings DROP COLUMN IF EXISTS id;
