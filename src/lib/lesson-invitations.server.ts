// Server-only logic for the Next Lesson Invitation system, shared by the
// manual "Send/Resend Invitation" button and the automatic pg_cron sweep.
import { remainingLessons } from "@/lib/student-balance";

const REMINDER_AFTER_MS = 4 * 3600000; // 4 hours
const EXPIRE_AFTER_MS = 48 * 3600000; // stop considering this invitation cycle

function bookingUrlFor(origin: string, token: string): string {
  return `${origin}/next-lesson/${token}`;
}

export async function sendLessonInvitation(
  supabaseAdmin: any,
  { studentId, origin }: { studentId: string; origin: string },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("id, full_name, phone, school_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false, reason: "Student not found" };
  if (!student.phone) return { ok: false, reason: "This student has no phone number on file" };

  const remaining = await remainingLessons(supabaseAdmin, studentId);
  if (remaining <= 0) return { ok: false, reason: "This student has no remaining lessons" };

  const { data: invitation, error } = await supabaseAdmin
    .from("lesson_invitations")
    .insert({ student_id: studentId, school_id: student.school_id })
    .select("token")
    .single();
  if (error || !invitation)
    return { ok: false, reason: error?.message ?? "Could not create invitation" };

  const { data: settings } = await supabaseAdmin
    .from("school_settings")
    .select("school_name")
    .eq("school_id", student.school_id)
    .maybeSingle();

  const url = bookingUrlFor(origin, invitation.token);
  const schoolName = settings?.school_name ?? "your driving school";
  const firstName = student.full_name?.split(" ")[0] || "there";
  const { sendSms } = await import("@/lib/sms.server");
  await sendSms(
    student.phone,
    `Hi ${firstName}, ready for your next lesson with ${schoolName}? Book here: ${url}`,
  );
  return { ok: true };
}

// Runs the three-part sweep: send new invitations to eligible students,
// send exactly one reminder for invitations past 4 hours, and expire
// invitation cycles that have gone unanswered so a student can become
// eligible again later if circumstances change.
export async function runInvitationSweep(supabaseAdmin: any, origin: string) {
  const now = Date.now();
  const results = { sent: 0, reminded: 0, expired: 0 };

  // 1. New invitations for eligible students at schools with auto-invite on.
  const { data: schools } = await supabaseAdmin
    .from("school_settings")
    .select("school_id")
    .eq("auto_invitations_enabled", true);

  for (const school of schools ?? []) {
    const { data: students } = await supabaseAdmin
      .from("students")
      .select("id, lessons_purchased, bookings(id, scheduled_at, status)")
      .eq("school_id", school.school_id)
      .is("deleted_at", null);

    for (const student of students ?? []) {
      const bookings = student.bookings ?? [];
      if (bookings.length === 0) continue;

      const hasUpcoming = bookings.some(
        (b: any) =>
          new Date(b.scheduled_at).getTime() > now && !["cancelled", "declined"].includes(b.status),
      );
      if (hasUpcoming) continue;

      const pastBookings = bookings
        .filter((b: any) => new Date(b.scheduled_at).getTime() <= now)
        .sort(
          (a: any, b: any) =>
            new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(),
        );
      if (pastBookings.length === 0 || pastBookings[0].status !== "completed") continue;

      const { count: completedCount } = await supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("student_id", student.id)
        .eq("status", "completed");
      const remaining = (student.lessons_purchased ?? 0) - (completedCount ?? 0);
      if (remaining <= 0) continue;

      const { count: activeInvites } = await supabaseAdmin
        .from("lesson_invitations")
        .select("id", { count: "exact", head: true })
        .eq("student_id", student.id)
        .in("status", ["sent", "reminded"]);
      if ((activeInvites ?? 0) > 0) continue;

      const result = await sendLessonInvitation(supabaseAdmin, { studentId: student.id, origin });
      if (result.ok) results.sent++;
    }
  }

  // 2. Reminders for invitations past 4 hours with no booking.
  const { data: dueForReminder } = await supabaseAdmin
    .from("lesson_invitations")
    .select("id, student_id, school_id, token")
    .eq("status", "sent")
    .lte("sent_at", new Date(now - REMINDER_AFTER_MS).toISOString());

  for (const inv of dueForReminder ?? []) {
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("full_name, phone")
      .eq("id", inv.student_id)
      .maybeSingle();
    if (student?.phone) {
      const url = bookingUrlFor(origin, inv.token);
      const firstName = student.full_name?.split(" ")[0] || "there";
      const { sendSms } = await import("@/lib/sms.server");
      await sendSms(student.phone, `Hi ${firstName}, still want to book your next lesson? ${url}`);
    }
    await supabaseAdmin
      .from("lesson_invitations")
      .update({ status: "reminded", reminder_sent_at: new Date(now).toISOString() })
      .eq("id", inv.id);
    results.reminded++;
  }

  // 3. Expire stale invitation cycles so eligibility can be reassessed later.
  const { data: expired } = await supabaseAdmin
    .from("lesson_invitations")
    .update({ status: "expired" })
    .in("status", ["sent", "reminded"])
    .lte("sent_at", new Date(now - EXPIRE_AFTER_MS).toISOString())
    .select("id");
  results.expired = expired?.length ?? 0;

  return results;
}
