import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireStudentSession } from "@/lib/student-portal-auth.server";
import { remainingLessons } from "@/lib/student-balance";
import { pickInstructor } from "@/lib/public-booking.functions";
import { NO_SHOW_ESCALATION_THRESHOLD } from "@/lib/no-show";
import { isBookingConflictError, BOOKING_CONFLICT_MESSAGE } from "@/lib/booking-conflict-error";

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

    const [{ data: lessonTypes }, { data: settings }, remaining, { count: femaleCount }] =
      await Promise.all([
        supabaseAdmin
          .from("lesson_types")
          .select("id, name, description, duration_minutes, price_cents, category")
          .eq("school_id", schoolId)
          .eq("active", true)
          .order("sort_order"),
        supabaseAdmin
          .from("school_settings")
          .select("booking_paused, mpi_test_locations, theory_lessons_enabled, vehicle_rental_enabled")
          .eq("school_id", schoolId)
          .maybeSingle(),
        remainingLessons(supabaseAdmin, studentId),
        supabaseAdmin
          .from("instructors")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .eq("active", true)
          .eq("is_female", true),
      ]);

    return {
      lessonTypes: (lessonTypes ?? []).filter((t: any) => {
        if (t.category === "theory") return !!settings?.theory_lessons_enabled;
        if (t.category === "road_test" || t.category === "car_rental")
          return !!settings?.vehicle_rental_enabled;
        return true;
      }),
      remaining,
      bookingPaused: !!settings?.booking_paused,
      mpiTestLocations: settings?.mpi_test_locations ?? [],
      hasFemaleInstructor: (femaleCount ?? 0) > 0,
    };
  });

const SubmitBookingSchema = z.object({
  sessionToken: z.string(),
  lesson_type_id: z.string().uuid(),
  scheduled_at: z.string().datetime(),
  mpi_test_location: z.string().trim().max(200).optional().nullable(),
  female_instructor_only: z.boolean().optional(),
});

export const submitPortalBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SubmitBookingSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { studentId, schoolId } = await requireStudentSession(supabaseAdmin, data.sessionToken);

    const { data: settings } = await supabaseAdmin
      .from("school_settings")
      .select("require_approval, auto_assign_instructor, booking_paused")
      .eq("school_id", schoolId)
      .maybeSingle();
    if (settings?.booking_paused) {
      throw new Error("This school isn't accepting new bookings right now. Please check back later.");
    }

    const remaining = await remainingLessons(supabaseAdmin, studentId);
    if (remaining <= 0) {
      throw new Error(
        "You have no remaining lessons in your package. Contact your school to purchase more.",
      );
    }

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, pickup_address")
      .eq("id", studentId)
      .maybeSingle();
    if (!student) throw new Error("Student not found.");

    const { data: lt, error: ltErr } = await supabaseAdmin
      .from("lesson_types")
      .select("id, duration_minutes, price_cents, active, school_id")
      .eq("id", data.lesson_type_id)
      .eq("school_id", schoolId)
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
      .eq("student_id", studentId)
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
          schoolId,
          data.scheduled_at,
          lt.duration_minutes,
          !!data.female_instructor_only,
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
