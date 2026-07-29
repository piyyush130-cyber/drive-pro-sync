// Server-only booking notification emails. Best-effort: a failed send is
// logged (see sendEmail) but never throws back into the caller, so a
// notification issue can't break a booking mutation.
import { fmtDate, fmtTime, money } from "@/lib/format";

type Ctx = {
  bookingId: string;
};

async function loadBooking(supabaseAdmin: any, bookingId: string) {
  const { data } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, scheduled_at, price_cents, status, school_id, instructor_id, " +
        "students(full_name, email), lesson_types(name), instructors(full_name, email)",
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

  if (b.students?.email) {
    if (b.status === "confirmed") {
      await sendEmail({
        to: b.students.email,
        subject: `Booking confirmed — ${school}`,
        html: layout("Your lesson is confirmed", details),
      });
    } else {
      await sendEmail({
        to: b.students.email,
        subject: `Booking received — ${school}`,
        html: layout(
          "We've got your request",
          details + `<p style="font-size: 14px;">${school} will confirm your booking shortly.</p>`,
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

  if (patch.status === "cancelled" && b.students?.email) {
    await sendEmail({
      to: b.students.email,
      subject: `Booking cancelled — ${school}`,
      html: layout("Your lesson was cancelled", details),
    });
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
