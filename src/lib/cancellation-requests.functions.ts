import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeCancellationFeeCents } from "@/lib/cancellation-fee";

const Schema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  waiveFee: z.boolean().optional(),
});

// The only place the late-cancellation fee is applied — deliberately not
// folded into the generic booking-status-change notifier, since that's
// also hit by school-initiated cancellations (bulk-cancel, instructor
// offboarding) which must never be charged a fee. This is the admin
// checkpoint: they see the computed fee and can waive it before approving.
export const resolveCancellationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Schema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: request } = await context.supabase
      .from("cancellation_requests")
      .select("id, booking_id, school_id, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!request) throw new Error("Cancellation request not found");
    if (request.status !== "requested") throw new Error("This request was already resolved.");

    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("school_id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .eq("school_id", request.school_id)
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, price_cents, scheduled_at, school_id, students(full_name, email, phone), lesson_types(name)",
      )
      .eq("id", request.booking_id)
      .maybeSingle();
    if (!booking) throw new Error("Booking not found");

    const { sendEmail } = await import("@/lib/email.server");
    const { fmtDate, fmtTime, money } = await import("@/lib/format");
    const { data: settingsRow } = await supabaseAdmin
      .from("school_settings")
      .select("school_name, late_cancel_fee_type, late_cancel_fee_value")
      .eq("school_id", request.school_id)
      .maybeSingle();
    const schoolName = settingsRow?.school_name ?? "your driving school";
    const when = `${fmtDate(booking.scheduled_at)} at ${fmtTime(booking.scheduled_at)}`;

    if (data.decision === "reject") {
      await context.supabase
        .from("cancellation_requests")
        .update({ status: "rejected", resolved_at: new Date().toISOString() })
        .eq("id", request.id);

      if (booking.students?.email) {
        await sendEmail({
          to: booking.students.email,
          subject: `Your cancellation request wasn't approved — ${schoolName}`,
          html: `<div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1A1A2E;">
            <h2>Your lesson is still on</h2>
            <p style="font-size: 14px;">${schoolName} wasn't able to approve your cancellation request for ${when}. Your lesson remains scheduled — contact them directly with any questions.</p>
          </div>`,
        });
      }
      return { ok: true, feeCents: 0 };
    }

    const feeCents = data.waiveFee
      ? 0
      : computeCancellationFeeCents(
          settingsRow?.late_cancel_fee_type ?? "none",
          settingsRow?.late_cancel_fee_value ?? 0,
          booking.price_cents,
        );

    await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled", price_cents: feeCents, payment_status: "unpaid" })
      .eq("id", booking.id);

    await context.supabase
      .from("cancellation_requests")
      .update({ status: "approved", resolved_at: new Date().toISOString() })
      .eq("id", request.id);

    if (booking.students?.email) {
      await sendEmail({
        to: booking.students.email,
        subject: `Cancellation confirmed — ${schoolName}`,
        html: `<div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1A1A2E;">
          <h2>Your lesson was cancelled</h2>
          <p style="font-size: 14px;">${schoolName} confirmed the cancellation of your ${when} lesson.${
            feeCents > 0
              ? ` A late cancellation fee of ${money(feeCents)} applies per their cancellation policy — please arrange payment directly with the school.`
              : ""
          }</p>
        </div>`,
      });
    }
    if (booking.students?.phone) {
      const { sendSms } = await import("@/lib/sms.server");
      await sendSms(
        booking.students.phone,
        `${schoolName}: your ${when} lesson cancellation is confirmed.${feeCents > 0 ? ` A late cancellation fee of ${money(feeCents)} applies — please arrange payment with the school.` : ""}`,
      );
    }

    const { maybeOfferWaitlistSlot } = await import("@/lib/waitlist.server");
    await maybeOfferWaitlistSlot(supabaseAdmin, booking.id);

    return { ok: true, feeCents };
  });
