ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS auto_assign_instructor BOOLEAN NOT NULL DEFAULT false;
