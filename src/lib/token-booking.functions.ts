import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  pickInstructor,
  assertNotAppointmentOnly,
  assertInstructorAvailable,
  getAvailableInstructorProfiles,
} from "@/lib/public-booking.functions";
import { remainingLessons, remainingPackageHours } from "@/lib/student-balance";
import { NO_SHOW_ESCALATION_THRESHOLD } from "@/lib/no-show";
import { isBookingConflictError, BOOKING_CONFLICT_MESSAGE } from "@/lib/booking-conflict-error";
import { computeAppointmentOnlyDates, toDateKey } from "@/lib/schedule-overrides";
import { isBotSubmission } from "@/lib/booking-logic";

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

    const [
      { data: settings },
      { data: lessonTypes },
      { count: femaleCount },
      { data: overrides },
      { data: activeInstructors },
    ] = await Promise.all([
      supabaseAdmin
        .from("school_settings")
        .select(
          "school_name, booking_paused, mpi_test_locations, theory_lessons_enabled, vehicle_rental_enabled, online_payment_url, flexible_session_length_enabled, skill_level_filter_enabled, instructor_selection_enabled",
        )
        .eq("school_id", invitation.school_id)
        .maybeSingle(),
      supabaseAdmin
        .from("lesson_types")
        .select("id, name, description, duration_minutes, price_cents, category, skill_levels")
        .eq("school_id", invitation.school_id)
        .eq("active", true)
        .order("sort_order"),
      supabaseAdmin
        .from("instructors")
        .select("id", { count: "exact", head: true })
        .eq("school_id", invitation.school_id)
        .eq("active", true)
        .eq("is_female", true),
      supabaseAdmin
        .from("schedule_overrides")
        .select("date, instructor_id")
        .eq("school_id", invitation.school_id)
        .gte("date", toDateKey(new Date())),
      supabaseAdmin
        .from("instructors")
        .select("id")
        .eq("school_id", invitation.school_id)
        .eq("active", true)
        .eq("status", "active"),
    ]);

    const flexibleSessionLengthEnabled = !!settings?.flexible_session_length_enabled;
    const remainingPackageHrs = flexibleSessionLengthEnabled
      ? await remainingPackageHours(supabaseAdmin, student.id)
      : 0;
    const appointmentOnlyDates = computeAppointmentOnlyDates(
      overrides ?? [],
      (activeInstructors ?? []).map((i: any) => i.id),
    );

    return {
      firstName: student.full_name?.split(" ")[0] || "there",
      remaining,
      flexibleSessionLengthEnabled,
      remainingPackageHours: remainingPackageHrs,
      skillLevelFilterEnabled: !!settings?.skill_level_filter_enabled,
      instructorSelectionEnabled: !!settings?.instructor_selection_enabled,
      appointmentOnlyDates: Array.from(appointmentOnlyDates),
      schoolName: settings?.school_name ?? "your driving school",
      lessonTypes: (lessonTypes ?? []).filter((t: any) => {
        if (t.category === "theory") return !!settings?.theory_lessons_enabled;
        if (t.category === "road_test" || t.category === "car_rental")
          return !!settings?.vehicle_rental_enabled;
        return true;
      }),
      bookingPaused: !!settings?.booking_paused,
      mpiTestLocations: settings?.mpi_test_locations ?? [],
      onlinePaymentUrl: settings?.online_payment_url ?? null,
      hasFemaleInstructor: (femaleCount ?? 0) > 0,
    };
  });

const AvailableInstructorsForSlotSchema = z.object({
  token: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().positive(),
});

export const getTokenAvailableInstructors = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AvailableInstructorsForSlotSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invitation } = await supabaseAdmin
      .from("lesson_invitations")
      .select("school_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!invitation) throw new Error("This link is no longer valid.");
    const instructors = await getAvailableInstructorProfiles(
      supabaseAdmin,
      invitation.school_id,
      data.scheduledAt,
      data.durationMinutes,
    );
    return { instructors };
  });

const BookSchema = z.object({
  token: z.string().uuid(),
  lesson_type_id: z.string().uuid(),
  scheduled_at: z.string().datetime(),
  mpi_test_location: z.string().trim().max(200).optional().nullable(),
  selected_instructor_id: z.string().uuid().optional(),
  female_instructor_only: z.boolean().optional(),
  session_hours: z.number().positive().max(24).optional(),
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

    const { data: settings } = await supabaseAdmin
      .from("school_settings")
      .select("require_approval, auto_assign_instructor, booking_paused, flexible_session_length_enabled")
      .eq("school_id", invitation.school_id)
      .maybeSingle();
    if (settings?.booking_paused) {
      throw new Error("This school isn't accepting new bookings right now. Please check back later.");
    }

    const { data: lt, error: ltErr } = await supabaseAdmin
      .from("lesson_types")
      .select("id, duration_minutes, price_cents, active, school_id, category")
      .eq("id", data.lesson_type_id)
      .eq("school_id", invitation.school_id)
      .maybeSingle();
    if (ltErr) throw new Error("Could not load lesson type");
    if (!lt || !lt.active) throw new Error("Invalid lesson type");

    await assertNotAppointmentOnly(supabaseAdmin, invitation.school_id, data.scheduled_at);

    const useFlexibleHours = !!settings?.flexible_session_length_enabled && lt.category === "package";
    let bookingDurationMinutes = lt.duration_minutes;
    let bookingPriceCents = lt.price_cents;

    if (useFlexibleHours) {
      const remainingHours = await remainingPackageHours(supabaseAdmin, student.id);
      if (remainingHours <= 0) {
        throw new Error("You have no remaining hours in your package.");
      }
      if (!data.session_hours || data.session_hours > remainingHours) {
        throw new Error(`Choose a session length up to your ${remainingHours} remaining hours.`);
      }
      bookingDurationMinutes = Math.round(data.session_hours * 60);
      bookingPriceCents = lt.duration_minutes
        ? Math.round((lt.price_cents * bookingDurationMinutes) / lt.duration_minutes)
        : lt.price_cents;
    } else {
      const remaining = await remainingLessons(supabaseAdmin, student.id);
      if (remaining <= 0) throw new Error("You have no remaining lessons in your package.");
    }

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

    let instructorId: string | null = null;
    if (data.selected_instructor_id) {
      await assertInstructorAvailable(
        supabaseAdmin,
        invitation.school_id,
        data.selected_instructor_id,
        data.scheduled_at,
        bookingDurationMinutes,
      );
      instructorId = data.selected_instructor_id;
    } else if (settings?.auto_assign_instructor) {
      instructorId = await pickInstructor(
        supabaseAdmin,
        invitation.school_id,
        data.scheduled_at,
        bookingDurationMinutes,
        !!data.female_instructor_only,
      );
    }

    const { data: booking, error: bErr } = await supabaseAdmin
      .from("bookings")
      .insert({
        student_id: student.id,
        instructor_id: instructorId,
        lesson_type_id: lt.id,
        scheduled_at: data.scheduled_at,
        duration_minutes: bookingDurationMinutes,
        pickup_address: student.pickup_address,
        dropoff_address: student.pickup_address,
        female_instructor_requested: !!data.female_instructor_only,
        price_cents: bookingPriceCents,
        status: initialStatus,
        school_id: invitation.school_id,
        mpi_test_location: data.mpi_test_location || null,
      })
      .select("id")
      .single();
    if (bErr && isBookingConflictError(bErr)) throw new Error(BOOKING_CONFLICT_MESSAGE);
    if (bErr || !booking) throw new Error("Could not create booking");

    await supabaseAdmin
      .from("lesson_invitations")
      .update({ status: "booked", booked_at: new Date().toISOString(), booking_id: booking.id })
      .eq("id", invitation.id);

    const { notifyBookingCreated } = await import("@/lib/notifications.server");
    await notifyBookingCreated(supabaseAdmin, { bookingId: booking.id });

    return { ok: true, status: initialStatus };
  });

const TokenAppointmentRequestSchema = z.object({
  token: z.string().uuid(),
  preferred_date: z.string().trim().max(20).optional(),
  message: z.string().trim().max(2000).optional(),
  website: z.string().max(200).optional(),
  formRenderedAt: z.number().optional(),
});

export const submitTokenAppointmentRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TokenAppointmentRequestSchema.parse(d))
  .handler(async ({ data }) => {
    if (isBotSubmission(data)) return { ok: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invitation } = await supabaseAdmin
      .from("lesson_invitations")
      .select("student_id, school_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!invitation) throw new Error("This link is no longer valid.");

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("full_name, email, phone")
      .eq("id", invitation.student_id)
      .maybeSingle();
    if (!student) throw new Error("This link is no longer valid.");

    const { error } = await supabaseAdmin.from("appointment_requests").insert({
      school_id: invitation.school_id,
      full_name: student.full_name,
      email: student.email,
      phone: student.phone,
      preferred_date: data.preferred_date || null,
      message: data.message || null,
    });
    if (error) throw new Error("Could not submit your request");

    const { data: settings } = await supabaseAdmin
      .from("school_settings")
      .select("school_name")
      .eq("school_id", invitation.school_id)
      .maybeSingle();
    const school_name = settings?.school_name ?? "your driving school";

    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("profiles(email)")
      .eq("school_id", invitation.school_id)
      .eq("role", "admin");

    const { sendEmail } = await import("@/lib/email.server");
    for (const a of admins ?? []) {
      const email = (a as any).profiles?.email;
      if (!email) continue;
      await sendEmail({
        to: email,
        subject: `Appointment request — ${student.full_name}`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1A1A2E;">
            <h2 style="margin-bottom: 8px;">A student is requesting an appointment</h2>
            <p style="color: #6B6B7B; font-size: 14px;">${school_name}</p>
            <ul style="list-style: none; padding: 0; font-size: 14px; line-height: 1.8;">
              <li><strong>Name:</strong> ${student.full_name}</li>
              ${student.email ? `<li><strong>Email:</strong> ${student.email}</li>` : ""}
              ${student.phone ? `<li><strong>Phone:</strong> ${student.phone}</li>` : ""}
              ${data.preferred_date ? `<li><strong>Preferred date:</strong> ${data.preferred_date}</li>` : ""}
            </ul>
            ${data.message ? `<p style="font-size: 14px; white-space: pre-wrap;">${data.message}</p>` : ""}
            <p style="color: #94A3B8; font-size: 11px; margin-top: 24px; padding-top: 12px; border-top: 1px solid #E2E8F0;">
              Sent via DrivingOps
            </p>
          </div>
        `,
      });
    }

    return { ok: true };
  });
