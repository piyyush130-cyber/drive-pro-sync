-- policy_acceptances never actually existed on this live database, despite
-- being defined in 20260728120000_add_policy_acceptances.sql — that
-- migration was applied before an early .env project mixup was corrected
-- (see project history), so it landed against a different Supabase
-- project and never made it to this one. The app has referenced this
-- table ever since, so every policy-acceptance read/write against
-- production has been silently failing: the write (service-role client
-- in the server function) errors and is swallowed by an unhandled
-- promise rejection client-side, and the read always comes back empty —
-- so "I agree — continue" appeared to do nothing, and every login looked
-- like it needed re-acceptance with no error ever shown.
DO $$ BEGIN
  CREATE TYPE public.policy_type AS ENUM ('terms_of_service', 'privacy_policy');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.policy_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_type public.policy_type NOT NULL,
  version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, policy_type, version)
);
CREATE INDEX IF NOT EXISTS idx_pa_user ON public.policy_acceptances(user_id);
GRANT SELECT, INSERT ON public.policy_acceptances TO authenticated;
GRANT ALL ON public.policy_acceptances TO service_role;
ALTER TABLE public.policy_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_read_own" ON public.policy_acceptances;
CREATE POLICY "pa_read_own" ON public.policy_acceptances FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "pa_admin_read" ON public.policy_acceptances;
CREATE POLICY "pa_admin_read" ON public.policy_acceptances FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
