import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { pickInstructor } from "@/lib/public-booking.functions";
import { remainingLessons } from "@/lib/student-balance";
import { NO_SHOW_ESCALATION_THRESHOLD } from "@/lib/no-show";

const TokenSchema = z.object({ token: z.string().uuid() });

// Public — resolves a lesson_invitations token to just enough for the
// booking page to render: the student's first name, remaining lesson
// count, and the school's lesson types. No login, and nothing about the
// student beyond what's needed to book is exposed.
export const getInvitationForToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invitation } = await supabaseAdmin
      .from("lesson_invitations")
      .select("id, status, student_id, school_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!invitation) throw new Error("This link is no longer valid.");
    if (invitation.status === "booked")
      throw new Error("This invitation has already been used to book a lesson.");
    if (invitation.status === "expired")
      throw new Error("This link has expired. Ask your school to send a new one.");

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, full_name")
      .eq("id", invitation.student_id)
      .maybeSingle();
    if (!student) throw new Error("This link is no longer valid.");

    const remaining = await remainingLessons(supabaseAdmin, student.id);

    const [{ data: settings }, { data: lessonTypes }] = await Promise.all([
      supabaseAdmin
        .from("school_settings")
        .select("school_name, booking_paused")
        .eq("school_id", invitation.school_id)
        .maybeSingle(),
      supabaseAdmin
        .from("lesson_types")
        .select("id, name, description, duration_minutes, price_cents")
        .eq("school_id", invitation.school_id)
        .eq("active", true)
        .order("sort_order"),
    ]);

    return {
      firstName: student.full_name?.split(" ")[0] || "there",
      remaining,
      schoolName: settings?.school_name ?? "your driving school",
      lessonTypes: lessonTypes ?? [],
      bookingPaused: !!settings?.booking_paused,
    };
  });

const BookSchema = z.object({
  token: z.string().uuid(),
  lesson_type_id: z.string().uuid(),
  scheduled_at: z.string().datetime(),
});

export const submitTokenBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => BookSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invitation } = await supabaseAdmin
      .from("lesson_invitations")
      .select("id, status, student_id, school_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!invitation) throw new Error("This link is no longer valid.");
    if (invitation.status === "booked")
      throw new Error("This invitation has already been used to book a lesson.");
    if (invitation.status === "expired")
      throw new Error("This link has expired. Ask your school to send a new one.");

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, full_name, phone, email, pickup_address")
      .eq("id", invitation.student_id)
      .maybeSingle();
    if (!student) throw new Error("This link is no longer valid.");

    const remaining = await remainingLessons(supabaseAdmin, student.id);
    if (remaining <= 0) throw new Error("You have no remaining lessons in your package.");

    const { data: settings } = await supabaseAdmin
      .from("school_settings")
      .select("require_approval, auto_assign_instructor, booking_paused")
      .eq("school_id", invitation.school_id)
      .maybeSingle();
    if (settings?.booking_paused) {
      throw new Error("This school isn't accepting new bookings right now. Please check back later.");
    }

    const { data: lt, error: ltErr } = await supabaseAdmin
      .from("lesson_types")
      .select("id, duration_minutes, price_cents, active, school_id")
      .eq("id", data.lesson_type_id)
      .eq("school_id", invitation.school_id)
      .maybeSingle();
    if (ltErr) throw new Error("Could not load lesson type");
    if (!lt || !lt.active) throw new Error("Invalid lesson type");

    // No-show escalation: a student with a history of no-shows never
    // auto-confirms, regardless of the school's approval settings — there's
    // no payment gateway to require prepayment against, so a manual admin
    // confirmation is the only guardrail available.
    const { count: noShowCount } = await supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("student_id", student.id)
      .eq("status", "no_show");
    const flagged = (noShowCount ?? 0) >= NO_SHOW_ESCALATION_THRESHOLD;

    const initialStatus = flagged
      ? "pending"
      : settings?.require_approval === false
        ? "confirmed"
        : "pending";

    const instructorId = settings?.auto_assign_instructor
      ? await pickInstructor(
          supabaseAdmin,
          invitation.school_id,
          data.scheduled_at,
          lt.duration_minutes,
        )
      : null;

    const { data: booking, error: bErr } = await supabaseAdmin
      .from("bookings")
      .insert({
        student_id: student.id,
        instructor_id: instructorId,
        lesson_type_id: lt.id,
        scheduled_at: data.scheduled_at,
        duration_minutes: lt.duration_minutes,
        pickup_address: student.pickup_address,
        dropoff_address: student.pickup_address,
        price_cents: lt.price_cents,
        status: initialStatus,
        school_id: invitation.school_id,
      })
      .select("id")
      .single();
    if (bErr || !booking) throw new Error("Could not create booking");

    await supabaseAdmin
      .from("lesson_invitations")
      .update({ status: "booked", booked_at: new Date().toISOString(), booking_id: booking.id })
      .eq("id", invitation.id);

    const { notifyBookingCreated } = await import("@/lib/notifications.server");
    await notifyBookingCreated(supabaseAdmin, { bookingId: booking.id });

    return { ok: true, status: initialStatus };
  });
