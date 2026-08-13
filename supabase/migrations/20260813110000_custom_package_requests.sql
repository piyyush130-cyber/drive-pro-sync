CREATE TABLE public.custom_package_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_package_requests ENABLE ROW LEVEL SECURITY;

-- Admins can view/manage requests for their own school; inserts happen
-- exclusively through the public server function via supabaseAdmin
-- (service role bypasses RLS), so no anon/authenticated INSERT policy
-- is needed here.
CREATE POLICY cpr_admin_all ON public.custom_package_requests
  FOR ALL
  USING (has_role_in_school(auth.uid(), school_id, 'admin'))
  WITH CHECK (has_role_in_school(auth.uid(), school_id, 'admin'));
