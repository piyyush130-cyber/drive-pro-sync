-- Purely a convenience link to a school's own external payment page (their
-- own Stripe Checkout link, a page on their website, etc). No integration,
-- no webhook, no data exchange — payment status is still marked manually
-- by the admin exactly as it works today. Empty/unset means no "Pay
-- online" button appears anywhere.
ALTER TABLE public.school_settings
  ADD COLUMN online_payment_url TEXT;
