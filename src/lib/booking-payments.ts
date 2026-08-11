import { supabase } from "@/integrations/supabase/client";

export type PaymentMethod = "cash" | "etransfer" | "card" | "other";

// Records one payment against a booking and recomputes the booking's
// payment_status/payment_method/paid_at from the full ledger — those
// columns stay the source of truth every existing reader (dashboard
// stats, status pills) already relies on, just derived now instead of
// hand-set. 'deposit_paid' means "something's been paid, not fully yet";
// it was already in the enum but no code path used to produce it.
export async function recordBookingPayment(
  booking: { id: string; school_id: string; price_cents: number },
  amountCents: number,
  method: PaymentMethod,
): Promise<{ totalPaid: number; remaining: number; status: string }> {
  const { error: insErr } = await supabase.from("booking_payments").insert({
    booking_id: booking.id,
    school_id: booking.school_id,
    amount_cents: amountCents,
    method,
  });
  if (insErr) throw insErr;

  const totalPaid = await getTotalPaid(booking.id);
  const status = totalPaid >= booking.price_cents ? "paid" : totalPaid > 0 ? "deposit_paid" : "unpaid";

  const patch: Record<string, unknown> = { payment_status: status, payment_method: method };
  if (status === "paid") patch.paid_at = new Date().toISOString();

  const { error: updErr } = await supabase.from("bookings").update(patch).eq("id", booking.id);
  if (updErr) throw updErr;

  return { totalPaid, remaining: Math.max(0, booking.price_cents - totalPaid), status };
}

export async function getTotalPaid(bookingId: string): Promise<number> {
  const { data, error } = await supabase
    .from("booking_payments")
    .select("amount_cents")
    .eq("booking_id", bookingId);
  if (error) throw error;
  return (data ?? []).reduce((sum, p) => sum + p.amount_cents, 0);
}
