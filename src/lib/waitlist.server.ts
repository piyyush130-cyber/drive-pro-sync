// Best-effort: called after a future booking is cancelled or no-showed to
// offer the freed instructor slot to the longest-waiting eligible waitlist
// entry (skipping anyone with no lessons left in their package). Only the
// single top-priority entry is offered — if it goes unclaimed there's no
// automatic cascade to the next one yet (that would need a scheduled job);
// an admin can add the student back to re-trigger, or this fires again
// automatically the next time a slot opens.
import { getRequest } from "@tanstack/react-start/server";
import { generateToken, hashToken } from "@/lib/student-portal-token.server";
import { remainingLessons } from "@/lib/student-balance";
import { fmtDate, fmtTime } from "@/lib/format";

const OFFER_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function originFromRequest(): string {
  const request = getRequest();
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function maybeOfferWaitlistSlot(supabaseAdmin: any, bookingId: string) {
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, school_id, instructor_id, lesson_type_id, scheduled_at, duration_minutes")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking || !booking.instructor_id) return;
  if (new Date(booking.scheduled_at).getTime() <= Date.now()) return;

  const { data: entries } = await supabaseAdmin
    .from("waitlist_entries")
    .select("id, student_id")
    .eq("school_id", booking.school_id)
    .eq("status", "waiting")
    .order("created_at");
  if (!entries || entries.length === 0) return;

  for (const entry of entries) {
    const remaining = await remainingLessons(supabaseAdmin, entry.student_id);
    if (remaining <= 0) continue;

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("full_name, phone, email")
      .eq("id", entry.student_id)
      .maybeSingle();
    if (!student || (!student.phone && !student.email)) continue;

    const rawToken = generateToken();
    const expiresAt = new Date(
      Math.min(Date.now() + OFFER_TTL_MS, new Date(booking.scheduled_at).getTime()),
    ).toISOString();

    const { error: offerErr } = await supabaseAdmin.from("waitlist_offers").insert({
      waitlist_entry_id: entry.id,
      school_id: booking.school_id,
      instructor_id: booking.instructor_id,
      lesson_type_id: booking.lesson_type_id,
      scheduled_at: booking.scheduled_at,
      duration_minutes: booking.duration_minutes,
      token_hash: hashToken(rawToken),
      expires_at: expiresAt,
    });
    if (offerErr) continue;

    const { data: school } = await supabaseAdmin
      .from("school_settings")
      .select("school_name")
      .eq("school_id", booking.school_id)
      .maybeSingle();
    const schoolName = school?.school_name ?? "your driving school";
    const firstName = student.full_name?.split(" ")[0] || "there";
    const when = `${fmtDate(booking.scheduled_at)} at ${fmtTime(booking.scheduled_at)}`;
    const url = `${originFromRequest()}/claim/${rawToken}`;

    if (student.phone) {
      const { sendSms } = await import("@/lib/sms.server");
      await sendSms(
        student.phone,
        `${schoolName}: Hi ${firstName}, a lesson opened up on ${when}! First to claim it gets it: ${url}`,
      );
    }
    if (student.email) {
      const { sendEmail } = await import("@/lib/email.server");
      await sendEmail({
        to: student.email,
        subject: `A lesson slot just opened up — ${schoolName}`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1A1A2E;">
            <h2 style="margin-bottom: 8px;">A lesson slot opened up</h2>
            <p style="font-size: 14px;">Hi ${firstName}, ${schoolName} has an opening on ${when}.</p>
            <p style="margin: 20px 0;"><a href="${url}" style="background:#1B2B4B;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Claim this lesson</a></p>
            <p style="font-size: 12px; color: #6B6B7B;">First to claim it gets it — this link expires soon.</p>
          </div>
        `,
      });
    }
    return;
  }
}
