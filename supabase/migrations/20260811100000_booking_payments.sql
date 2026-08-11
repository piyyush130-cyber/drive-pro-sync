-- Partial/installment payment tracking on individual bookings. Not a
-- multi-lesson package-purchase unit — just a ledger of amounts collected
-- against a single booking's price_cents, so a deposit now + balance later
-- (or several smaller installments) can be recorded instead of only a
-- binary paid/unpaid flip.
--
-- bookings.payment_status/payment_method/paid_at stay the source of truth
-- for every existing reader (dashboard stats, status pills, etc.) — they
-- become derived from this ledger (recomputed whenever a payment is
-- recorded) rather than changing meaning, so nothing downstream needs to
-- change. 'deposit_paid' (already in the enum, previously never produced
-- by any code path) becomes the "partially paid" status.
CREATE TABLE public.booking_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  method public.payment_method NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bp_booking ON public.booking_payments(booking_id);

ALTER TABLE public.booking_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bp_admin_all" ON public.booking_payments FOR ALL TO authenticated
  USING (public.has_role_in_school(auth.uid(), school_id, 'admin'))
  WITH CHECK (public.has_role_in_school(auth.uid(), school_id, 'admin'));
