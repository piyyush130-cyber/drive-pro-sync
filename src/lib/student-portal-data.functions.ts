import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireStudentSession } from "@/lib/student-portal-auth.server";
import { remainingLessons, remainingPackageHours } from "@/lib/student-balance";
import {
  pickInstructor,
  assertNotAppointmentOnly,
  assertInstructorAvailable,
  getAvailableInstructorProfiles,
} from "@/lib/public-booking.functions";
import { NO_SHOW_ESCALATION_THRESHOLD } from "@/lib/no-show";
import { isBookingConflictError, BOOKING_CONFLICT_MESSAGE } from "@/lib/booking-conflict-error";
import { computeAppointmentOnlyDates, toDateKey } from "@/lib/schedule-overrides";
import { isBotSubmission } from "@/lib/booking-logic";

const SessionSchema = z.object({ sessionToken: z.string() });

export const getPortalHome = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SessionSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { studentId, schoolId } = await requireStudentSession(supabaseAdmin, data.sessionToken);

    const [{ data: student }, { data: settings }, { data: upcoming }, remaining] = await Promise.all([
      supabaseAdmin.from("students").select("full_name").eq("id", studentId).maybeSingle(),
      supabaseAdmin
        .from("school_settings")
        .select("school_name, cancellation_notice_hours, online_payment_url")
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabaseAdmin
        .from("bookings")
        .select(
          "id, scheduled_at, duration_minutes, pickup_address, status, payment_status, lesson_types(name, price_cents), instructors(full_name)",
        )
        .eq("student_id", studentId)
        .is("deleted_at", null)
        .gte("scheduled_at", new Date().toISOString())
        .not("status", "in", "(cancelled,declined)")
        .order("scheduled_at"),
      remainingLessons(supabaseAdmin, studentId),
    ]);

    return {
      studentName: student?.full_name ?? "",
      schoolName: settings?.school_name ?? "your driving school",
      selfCancelHours: settings?.cancellation_notice_hours ?? 0,
      remaining,
      upcoming: upcoming ?? [],
      onlinePaymentUrl: settings?.online_payment_url ?? null,
    };
  });

export const getPortalHistory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SessionSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { studentId } = await requireStudentSession(supabaseAdmin, data.sessionToken);

    const { data: rows } = await supabaseAdmin
      .from("bookings")
      .select("id, scheduled_at, status, lesson_types(name, price_cents), instructors(full_name)")
      .eq("student_id", studentId)
      .is("deleted_at", null)
      .lt("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: false })
      .limit(50);
    return rows ?? [];
  });

export const getPortalBookingOptions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SessionSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { studentId, schoolId } = await requireStudentSession(supabaseAdmin, data.sessionToken);

    const [
      { data: lessonTypes },
      { data: settings },
      remaining,
      { count: femaleCount },
      { data: overrides },
      { data: activeInstructors },
    ] = await Promise.all([
      supabaseAdmin
        .from("lesson_types")
        .select("id, name, description, duration_minutes, price_cents, category, skill_levels")
        .eq("school_id", schoolId)
        .eq("active", true)
        .order("sort_order"),
      supabaseAdmin
        .from("school_settings")
        .select(
          "booking_paused, mpi_test_locations, theory_lessons_enabled, vehicle_rental_enabled, flexible_session_length_enabled, skill_level_filter_enabled, instructor_selection_enabled",
        )
        .eq("school_id", schoolId)
        .maybeSingle(),
      remainingLessons(supabaseAdmin, studentId),
      supabaseAdmin
        .from("instructors")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("active", true)
        .eq("is_female", true),
      supabaseAdmin
        .from("schedule_overrides")
        .select("date, instructor_id")
        .eq("school_id", schoolId)
        .gte("date", toDateKey(new Date())),
      supabaseAdmin
        .from("instructors")
        .select("id")
        .eq("school_id", schoolId)
        .eq("active", true)
        .eq("status", "active"),
    ]);

    const flexibleSessionLengthEnabled = !!settings?.flexible_session_length_enabled;
    const remainingPackageHrs = flexibleSessionLengthEnabled
      ? await remainingPackageHours(supabaseAdmin, studentId)
      : 0;
    const appointmentOnlyDates = computeAppointmentOnlyDates(
      overrides ?? [],
      (activeInstructors ?? []).map((i: any) => i.id),
    );

    return {
      lessonTypes: (lessonTypes ?? []).filter((t: any) => {
        if (t.category === "theory") return !!settings?.theory_lessons_enabled;
        if (t.category === "road_test" || t.category === "car_rental")
          return !!settings?.vehicle_rental_enabled;
        return true;
      }),
      remaining,
      flexibleSessionLengthEnabled,
      remainingPackageHours: remainingPackageHrs,
      skillLevelFilterEnabled: !!settings?.skill_level_filter_enabled,
      instructorSelectionEnabled: !!settings?.instructor_selection_enabled,
      appointmentOnlyDates: Array.from(appointmentOnlyDates),
      bookingPaused: !!settings?.booking_paused,
      mpiTestLocations: settings?.mpi_test_locations ?? [],
      hasFemaleInstructor: (femaleCount ?? 0) > 0,
    };
  });

const AvailableInstructorsForSlotSchema = z.object({
  sessionToken: z.string(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().positive(),
});

export const getPortalAvailableInstructors = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AvailableInstructorsForSlotSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { schoolId } = await requireStudentSession(supabaseAdmin, data.sessionToken);
    const instructors = await getAvailableInstructorProfiles(
      supabaseAdmin,
      schoolId,
      data.scheduledAt,
      data.durationMinutes,
    );
    return { instructors };
  });

const SubmitBookingSchema = z.object({
  sessionToken: z.string(),
  lesson_type_id: z.string().uuid(),
  scheduled_at: z.string().datetime(),
  mpi_test_location: z.string().trim().max(200).optional().nullable(),
  female_instructor_only: z.boolean().optional(),
  selected_instructor_id: z.string().uuid().optional(),
  // Only used for category='package' bookings at a school with
  // flexible_session_length_enabled — the student's chosen session length,
  // in hours, drawn against remainingPackageHours instead of the fixed
  // lesson-type duration.
  session_hours: z.number().positive().max(24).optional(),
});

export const submitPortalBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SubmitBookingSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { studentId, schoolId } = await requireStudentSession(supabaseAdmin, data.sessionToken);

    const { data: settings } = await supabaseAdmin
      .from("school_settings")
      .select("require_approval, auto_assign_instructor, booking_paused, flexible_session_length_enabled")
      .eq("school_id", schoolId)
      .maybeSingle();
    if (settings?.booking_paused) {
      throw new Error("This school isn't accepting new bookings right now. Please check back later.");
    }

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, pickup_address")
      .eq("id", studentId)
      .maybeSingle();
    if (!student) throw new Error("Student not found.");

    const { data: lt, error: ltErr } = await supabaseAdmin
      .from("lesson_types")
      .select("id, duration_minutes, price_cents, active, school_id, category")
      .eq("id", data.lesson_type_id)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (ltErr) throw new Error("Could not load lesson type");
    if (!lt || !lt.active) throw new Error("Invalid lesson type");

    await assertNotAppointmentOnly(supabaseAdmin, schoolId, data.scheduled_at);

    const useFlexibleHours = !!settings?.flexible_session_length_enabled && lt.category === "package";
    let bookingDurationMinutes = lt.duration_minutes;
    let bookingPriceCents = lt.price_cents;

    if (useFlexibleHours) {
      const remainingHours = await remainingPackageHours(supabaseAdmin, studentId);
      if (remainingHours <= 0) {
        throw new Error(
          "You have no remaining hours in your package. Contact your school to purchase more.",
        );
      }
      if (!data.session_hours || data.session_hours > remainingHours) {
        throw new Error(`Choose a session length up to your ${remainingHours} remaining hours.`);
      }
      bookingDurationMinutes = Math.round(data.session_hours * 60);
      // Pro-rate the package price by the fraction of the fixed duration
      // actually booked, rather than always charging the full package price
      // for a shorter session.
      bookingPriceCents = lt.duration_minutes
        ? Math.round((lt.price_cents * bookingDurationMinutes) / lt.duration_minutes)
        : lt.price_cents;
    } else {
      const remaining = await remainingLessons(supabaseAdmin, studentId);
      if (remaining <= 0) {
        throw new Error(
          "You have no remaining lessons in your package. Contact your school to purchase more.",
        );
      }
    }

    // No-show escalation: a student with a history of no-shows never
    // auto-confirms, regardless of the school's approval settings — there's
    // no payment gateway to require prepayment against, so a manual admin
    // confirmation is the only guardrail available.
    const { count: noShowCount } = await supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
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
        schoolId,
        data.selected_instructor_id,
        data.scheduled_at,
        bookingDurationMinutes,
      );
      instructorId = data.selected_instructor_id;
    } else if (settings?.auto_assign_instructor) {
      instructorId = await pickInstructor(
        supabaseAdmin,
        schoolId,
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
        price_cents: bookingPriceCents,
        status: initialStatus,
        school_id: schoolId,
        mpi_test_location: data.mpi_test_location || null,
        female_instructor_requested: !!data.female_instructor_only,
      })
      .select("id")
      .single();
    if (bErr && isBookingConflictError(bErr)) throw new Error(BOOKING_CONFLICT_MESSAGE);
    if (bErr || !booking) throw new Error("Could not create booking");

    const { notifyBookingCreated } = await import("@/lib/notifications.server");
    await notifyBookingCreated(supabaseAdmin, { bookingId: booking.id });

    return { ok: true, status: initialStatus };
  });

const CancelSchema = z.object({
  sessionToken: z.string(),
  booking_id: z.string().uuid(),
  reason: z.string().max(2000).optional(),
});

// Cancels immediately if the school's self-cancel window allows it at this
// notice; otherwise falls back to the same request-and-await-admin-approval
// flow already used by the public/admin cancellation paths.
export const submitPortalCancellation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CancelSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { studentId, schoolId } = await requireStudentSession(supabaseAdmin, data.sessionToken);

    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, scheduled_at, status")
      .eq("id", data.booking_id)
      .eq("student_id", studentId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!booking) throw new Error("Booking not found.");
    if (booking.status === "cancelled" || booking.status === "declined") {
      throw new Error("This booking is already cancelled.");
    }
    if (booking.status === "completed") throw new Error("This lesson has already been completed.");

    const { data: settings } = await supabaseAdmin
      .from("school_settings")
      .select("cancellation_notice_hours")
      .eq("school_id", schoolId)
      .maybeSingle();
    const selfCancelHours = settings?.cancellation_notice_hours ?? 0;
    const hoursUntil = (new Date(booking.scheduled_at).getTime() - Date.now()) / 3600000;

    if (selfCancelHours > 0 && hoursUntil >= selfCancelHours) {
      const { error } = await supabaseAdmin
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", booking.id);
      if (error) throw new Error("Could not cancel booking.");
      const { maybeOfferWaitlistSlot } = await import("@/lib/waitlist.server");
      await maybeOfferWaitlistSlot(supabaseAdmin, booking.id);
      return { ok: true, mode: "cancelled" as const };
    }

    const { error } = await supabaseAdmin.from("cancellation_requests").insert({
      booking_id: booking.id,
      school_id: schoolId,
      reason: data.reason ?? null,
      status: "requested",
    });
    if (error) throw new Error("Could not submit cancellation request.");
    return { ok: true, mode: "requested" as const };
  });

const AppointmentRequestSchema = z.object({
  sessionToken: z.string(),
  preferred_date: z.string().trim().max(20).optional(),
  message: z.string().trim().max(2000).optional(),
  website: z.string().max(200).optional(),
  formRenderedAt: z.number().optional(),
});

// School id and contact details come from the authenticated session/student
// record, not the client, unlike the public booking page's version of this
// function — the portal already knows who's asking.
export const submitPortalAppointmentRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AppointmentRequestSchema.parse(d))
  .handler(async ({ data }) => {
    if (isBotSubmission(data)) return { ok: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { studentId, schoolId } = await requireStudentSession(supabaseAdmin, data.sessionToken);

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("full_name, email, phone")
      .eq("id", studentId)
      .maybeSingle();
    if (!student) throw new Error("Student not found.");

    const { error } = await supabaseAdmin.from("appointment_requests").insert({
      school_id: schoolId,
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
      .eq("school_id", schoolId)
      .maybeSingle();
    const school_name = settings?.school_name ?? "your driving school";

    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("profiles(email)")
      .eq("school_id", schoolId)
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
