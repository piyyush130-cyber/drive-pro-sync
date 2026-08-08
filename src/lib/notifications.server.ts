// Server-only booking notification emails. Best-effort: a failed send is
// logged (see sendEmail) but never throws back into the caller, so a
// notification issue can't break a booking mutation.
import { fmtDate, fmtTime, money } from "@/lib/format";
import { computeCancellationFeeCents } from "@/lib/cancellation-fee";

type Ctx = {
  bookingId: string;
};

async function loadBooking(supabaseAdmin: any, bookingId: string) {
  const { data } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, scheduled_at, price_cents, status, school_id, instructor_id, " +
        "students(full_name, email, phone), lesson_types(name), instructors(full_name, email)",
    )
    .eq("id", bookingId)
    .maybeSingle();
  return data;
}

async function loadSchoolName(supabaseAdmin: any, schoolId: string) {
  const { data } = await supabaseAdmin
    .from("school_settings")
    .select("school_name")
    .eq("school_id", schoolId)
    .maybeSingle();
  return data?.school_name ?? "your driving school";
}

function layout(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1A1A2E;">
      <h2 style="margin-bottom: 8px;">${title}</h2>
      ${bodyHtml}
      <p style="color: #94A3B8; font-size: 11px; margin-top: 24px; padding-top: 12px; border-top: 1px solid #E2E8F0;">
        Sent via DrivingOps
      </p>
    </div>
  `;
}

function bookingDetailsHtml(school: string, lessonName: string, when: string, priceCents: number) {
  return `
    <p style="color: #6B6B7B; font-size: 14px;">${school}</p>
    <ul style="list-style: none; padding: 0; font-size: 14px; line-height: 1.8;">
      <li><strong>Lesson:</strong> ${lessonName}</li>
      <li><strong>When:</strong> ${when}</li>
      <li><strong>Price:</strong> ${money(priceCents)}</li>
    </ul>
  `;
}

export async function notifyBookingCreated(supabaseAdmin: any, { bookingId }: Ctx) {
  const b = await loadBooking(supabaseAdmin, bookingId);
  if (!b) return;
  const school = await loadSchoolName(supabaseAdmin, b.school_id);
  const when = `${fmtDate(b.scheduled_at)} at ${fmtTime(b.scheduled_at)}`;
  const lessonName = b.lesson_types?.name ?? "Driving lesson";
  const details = bookingDetailsHtml(school, lessonName, when, b.price_cents);
  const { sendEmail } = await import("@/lib/email.server");

  const { data: policySettings } = await supabaseAdmin
    .from("school_settings")
    .select("cancellation_policy")
    .eq("school_id", b.school_id)
    .maybeSingle();
  const policyHtml = policySettings?.cancellation_policy
    ? `<p style="font-size: 12px; color: #6B6B7B; margin-top: 12px;"><strong>Cancellation policy:</strong> ${policySettings.cancellation_policy}</p>`
    : "";

  if (b.students?.email) {
    if (b.status === "confirmed") {
      await sendEmail({
        to: b.students.email,
        subject: `Booking confirmed — ${school}`,
        html: layout("Your lesson is confirmed", details + policyHtml),
      });
    } else {
      await sendEmail({
        to: b.students.email,
        subject: `Booking received — ${school}`,
        html: layout(
          "We've got your request",
          details +
            `<p style="font-size: 14px;">${school} will confirm your booking shortly.</p>` +
            policyHtml,
        ),
      });
    }
  }

  if (b.status === "pending") {
    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("profiles(email)")
      .eq("school_id", b.school_id)
      .eq("role", "admin");
    for (const a of admins ?? []) {
      const email = (a as any).profiles?.email;
      if (!email) continue;
      await sendEmail({
        to: email,
        subject: `New booking needs approval — ${b.students?.full_name ?? "New student"}`,
        html: layout(
          "A new booking needs your approval",
          bookingDetailsHtml(school, lessonName, when, b.price_cents) +
            `<p style="font-size: 14px;">From: ${b.students?.full_name ?? "—"}</p>`,
        ),
      });
    }
  }

  if (b.instructor_id && b.instructors?.email) {
    await sendEmail({
      to: b.instructors.email,
      subject: `New lesson assigned — ${when}`,
      html: layout(
        "You've been assigned a new lesson",
        bookingDetailsHtml(school, lessonName, when, b.price_cents) +
          `<p style="font-size: 14px;">Student: ${b.students?.full_name ?? "—"}</p>`,
      ),
    });
  }
}

export async function notifyBookingStatusChange(
  supabaseAdmin: any,
  { bookingId }: Ctx,
  patch: Record<string, unknown>,
) {
  const b = await loadBooking(supabaseAdmin, bookingId);
  if (!b) return;
  const school = await loadSchoolName(supabaseAdmin, b.school_id);
  const when = `${fmtDate(b.scheduled_at)} at ${fmtTime(b.scheduled_at)}`;
  const lessonName = b.lesson_types?.name ?? "Driving lesson";
  const details = bookingDetailsHtml(school, lessonName, when, b.price_cents);
  const { sendEmail } = await import("@/lib/email.server");

  if (patch.status === "confirmed" && b.students?.email) {
    await sendEmail({
      to: b.students.email,
      subject: `Booking confirmed — ${school}`,
      html: layout("Your lesson is confirmed", details),
    });
  }

  if (patch.status === "cancelled") {
    const reason = typeof patch.cancellation_reason === "string" ? patch.cancellation_reason : null;
    if (b.students?.email) {
      await sendEmail({
        to: b.students.email,
        subject: `Booking cancelled — ${school}`,
        html: layout(
          "Your lesson was cancelled",
          details + (reason ? `<p style="font-size: 14px;">${reason}</p>` : ""),
        ),
      });
    }
    if (b.students?.phone) {
      const { sendSms } = await import("@/lib/sms.server");
      await sendSms(
        b.students.phone,
        `${school}: your lesson on ${when} was cancelled.${reason ? ` ${reason}` : ""}`,
      );
    }
    const { maybeOfferWaitlistSlot } = await import("@/lib/waitlist.server");
    await maybeOfferWaitlistSlot(supabaseAdmin, b.id);
  }

  if (patch.status === "no_show") {
    // No-show is never school-initiated — always safe to apply the fee
    // here, unlike the generic "cancelled" branch above (which is also
    // hit by school-initiated cancellations like bulk-cancel and
    // instructor offboarding, so fee logic deliberately does NOT live
    // there — see resolveCancellationRequest for the late-cancel fee).
    const { data: settings } = await supabaseAdmin
      .from("school_settings")
      .select("no_show_fee_type, no_show_fee_value")
      .eq("school_id", b.school_id)
      .maybeSingle();
    const feeCents = computeCancellationFeeCents(
      settings?.no_show_fee_type ?? "none",
      settings?.no_show_fee_value ?? 0,
      b.price_cents,
    );
    await supabaseAdmin
      .from("bookings")
      .update({ price_cents: feeCents, payment_status: "unpaid" })
      .eq("id", b.id);

    if (feeCents > 0 && b.students?.email) {
      await sendEmail({
        to: b.students.email,
        subject: `Missed lesson — ${school}`,
        html: layout(
          "You missed your lesson",
          `<p style="font-size: 14px;">${school} recorded your ${when} lesson as a no-show. A no-show fee of ${money(feeCents)} applies per their cancellation policy — please arrange payment directly with the school.</p>`,
        ),
      });
    }
    if (feeCents > 0 && b.students?.phone) {
      const { sendSms } = await import("@/lib/sms.server");
      await sendSms(
        b.students.phone,
        `${school}: you missed your lesson on ${when}. A no-show fee of ${money(feeCents)} applies — please arrange payment with the school.`,
      );
    }

    const { maybeOfferWaitlistSlot } = await import("@/lib/waitlist.server");
    await maybeOfferWaitlistSlot(supabaseAdmin, b.id);
  }

  if ("instructor_id" in patch && patch.instructor_id && b.instructor_id && b.instructors?.email) {
    await sendEmail({
      to: b.instructors.email,
      subject: `New lesson assigned — ${when}`,
      html: layout(
        "You've been assigned a new lesson",
        details + `<p style="font-size: 14px;">Student: ${b.students?.full_name ?? "—"}</p>`,
      ),
    });
  }
}
