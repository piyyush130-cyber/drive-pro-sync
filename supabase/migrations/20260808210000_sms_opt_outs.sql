-- SMS opt-out (CASL/STOP compliance). Keyed by phone digits, not student —
-- a phone number that says STOP should stop hearing from us regardless of
-- which school's student record it's attached to, and public bookings
-- create a fresh student row every time so a per-student flag wouldn't
-- actually stick. Service-role only: written by the Twilio inbound webhook
-- and checked by every sendSms call, never read/written by app users.
CREATE TABLE public.sms_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_digits TEXT NOT NULL UNIQUE,
  opted_out_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;
