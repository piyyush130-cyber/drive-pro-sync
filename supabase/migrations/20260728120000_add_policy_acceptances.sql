CREATE TYPE public.policy_type AS ENUM ('terms_of_service', 'privacy_policy');

CREATE TABLE public.policy_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_type public.policy_type NOT NULL,
  version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, policy_type, version)
);
CREATE INDEX idx_pa_user ON public.policy_acceptances(user_id);
GRANT SELECT, INSERT ON public.policy_acceptances TO authenticated;
GRANT ALL ON public.policy_acceptances TO service_role;
ALTER TABLE public.policy_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_read_own" ON public.policy_acceptances FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "pa_admin_read" ON public.policy_acceptances FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
