-- Structured cancellation/no-show fees. Defaults to 'none' so no existing
-- school is affected until they opt in. Values: 'flat' is stored in cents
-- (matching every other money field in this app), 'percentage' is an
-- integer 0-100 applied against the lesson's price_cents.
ALTER TABLE public.school_settings
  ADD COLUMN late_cancel_fee_type TEXT NOT NULL DEFAULT 'none'
    CHECK (late_cancel_fee_type IN ('none', 'flat', 'percentage')),
  ADD COLUMN late_cancel_fee_value INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN no_show_fee_type TEXT NOT NULL DEFAULT 'none'
    CHECK (no_show_fee_type IN ('none', 'flat', 'percentage')),
  ADD COLUMN no_show_fee_value INTEGER NOT NULL DEFAULT 0;
