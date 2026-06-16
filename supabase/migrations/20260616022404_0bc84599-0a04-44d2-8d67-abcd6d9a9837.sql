
-- ============================================================
-- Phase 2: Instructor invite codes + approval status workflow
-- ============================================================

-- 1. Instructor status enum
DO $$ BEGIN
  CREATE TYPE public.instructor_status AS ENUM ('pending_approval', 'active', 'deactivated', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Add status columns to instructors
ALTER TABLE public.instructors
  ADD COLUMN IF NOT EXISTS status public.instructor_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_code_used text;

-- Existing instructors stay active; existing 'active' boolean kept for backwards compat

-- 3. Invite codes table
CREATE TABLE IF NOT EXISTS public.instructor_invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  max_uses int,
  used_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_invite_codes TO authenticated;
GRANT ALL ON public.instructor_invite_codes TO service_role;

ALTER TABLE public.instructor_invite_codes ENABLE ROW LEVEL SECURITY;

-- Admins manage codes; nobody else reads them (validation happens via security-definer in server fn with service role)
CREATE POLICY iic_admin_all ON public.instructor_invite_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER iic_set_updated_at
  BEFORE UPDATE ON public.instructor_invite_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Allow instructors to read their own row (already exists?), check & add safety
DO $$
DECLARE policy_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='instructors' AND policyname='instructors_self_read') INTO policy_exists;
  IF NOT policy_exists THEN
    EXECUTE 'CREATE POLICY instructors_self_read ON public.instructors FOR SELECT TO authenticated USING (profile_id = auth.uid())';
  END IF;
END $$;
