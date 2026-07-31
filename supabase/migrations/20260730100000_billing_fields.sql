-- Billing data lives in its own table rather than on schools/school_settings
-- because both of those are publicly readable (anon SELECT, USING (true))
-- for the public booking widget — billing status, Stripe IDs, and trial
-- dates are not meant to be public.

CREATE TYPE public.billing_status AS ENUM (
  'trialing', 'active', 'past_due', 'grace_period', 'locked', 'free_forever', 'suspended'
);
CREATE TYPE public.plan_key AS ENUM ('starter', 'professional', 'enterprise');
CREATE TYPE public.billing_interval AS ENUM ('monthly', 'annual');

CREATE TABLE public.school_billing (
  school_id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan public.plan_key,
  billing_interval public.billing_interval,
  billing_status public.billing_status NOT NULL DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ,
  grace_period_ends_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_school_billing_stripe_customer ON public.school_billing(stripe_customer_id);
CREATE INDEX idx_school_billing_stripe_subscription ON public.school_billing(stripe_subscription_id);

GRANT SELECT ON public.school_billing TO authenticated;
GRANT ALL ON public.school_billing TO service_role;
ALTER TABLE public.school_billing ENABLE ROW LEVEL SECURITY;

-- Admins can read their own school's billing status (Settings page).
-- No INSERT/UPDATE/DELETE policy for authenticated at all — every mutation
-- (checkout creation, Stripe webhooks, owner actions) goes through a
-- server function using the service role, never a direct client write.
CREATE POLICY "sb_admin_read" ON public.school_billing FOR SELECT TO authenticated
  USING (public.has_role_in_school(auth.uid(), school_id, 'admin'));

CREATE TRIGGER trg_sb_upd BEFORE UPDATE ON public.school_billing
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Grandfather in any school that existed before billing did — never
-- retroactively lock out an already-onboarded school.
INSERT INTO public.school_billing (school_id, billing_status)
SELECT id, 'free_forever' FROM public.schools
ON CONFLICT (school_id) DO NOTHING;
