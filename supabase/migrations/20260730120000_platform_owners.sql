-- Platform owner: not scoped to any school, so it doesn't fit user_roles'
-- (user_id, school_id, role) shape. A dedicated table + helper function,
-- checked the same way admin/instructor roles are checked elsewhere.
CREATE TABLE public.platform_owners (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_owners TO authenticated;
GRANT ALL ON public.platform_owners TO service_role;
ALTER TABLE public.platform_owners ENABLE ROW LEVEL SECURITY;
-- A user can check whether *they themselves* are an owner (drives client
-- redirect/gating); nobody can enumerate the full owner list from the client.
CREATE POLICY "po_read_own" ON public.platform_owners FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_platform_owner(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.is_platform_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_owner(UUID) TO authenticated, service_role;

-- Deliberately no cross-school RLS policies for owners beyond this — the
-- Owner Dashboard reads/writes everything through server functions using
-- the service role (checked against is_platform_owner), not direct client
-- queries, so it doesn't need its own carve-out on schools/school_billing/
-- instructors and doesn't add to the RLS surface that needs auditing.
