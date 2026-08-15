import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  RATE_LIMIT_MAX_BOOKINGS,
  RATE_LIMIT_WINDOW_MINUTES,
  isBotSubmission,
  pickBestInstructor,
} from "@/lib/booking-logic";
import { isValidPostalCode, isPickupAreaServiced } from "@/lib/postal-code";
import { isBookingConflictError, BOOKING_CONFLICT_MESSAGE } from "@/lib/booking-conflict-error";
import { computeAppointmentOnlyDates, toDateKey } from "@/lib/schedule-overrides";

const BookingSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(3).max(40),
  email: z.string().trim().email().max(200),
  // Required only when the lesson type has pickup enabled — enforced in
  // the handler once the lesson type is loaded, not here, since the schema
  // has no way to know that yet.
  pickup_address: z.string().trim().max(300).optional().default(""),
  postal_code: z.string().trim().max(10).optional().default(""),
  mpi_test_location: z.string().trim().max(200).optional().nullable(),
  female_instructor_only: z.boolean().optional(),
  dropoff_address: z.string().max(300).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  lesson_type_id: z.string().uuid(),
  scheduled_at: z.string().datetime(),
  school_id: z.string().uuid(),
  // Spam/bot protection (not shown to real users, see ServicePicker/form):
  // a honeypot field bots tend to fill in, and a form-render timestamp so
  // we can reject submissions that came back impossibly fast.
  website: z.string().max(200).optional(),
  formRenderedAt: z.number().optional(),
});

// Fetches active instructors + that day's bookings for the school, then
// delegates the actual selection to the pure, unit-tested pickBestInstructor.
export async function pickInstructor(
  supabaseAdmin: any,
  schoolId: string,
  scheduledAt: string,
  durationMinutes: number,
  femaleOnly = false,
): Promise<string | null> {
  const { data: allInstructors } = await supabaseAdmin
    .from("instructors")
    .select("id, weekly_availability, is_female")
    .eq("school_id", schoolId)
    .eq("active", true)
    .eq("status", "active");
  if (!allInstructors || allInstructors.length === 0) return null;

  const start = new Date(scheduledAt);
  const dateKey = toDateKey(start);
  const { data: dayOverrides } = await supabaseAdmin
    .from("schedule_overrides")
    .select("instructor_id")
    .eq("school_id", schoolId)
    .eq("date", dateKey);
  // A school-wide override for this date means nobody should be
  // auto-assigned — submitPublicBooking/submitPortalBooking/
  // submitTokenBooking also reject the submission outright for this case,
  // but this is a second line of defense against a manually-crafted request.
  if ((dayOverrides ?? []).some((o: any) => !o.instructor_id)) return null;
  const blockedInstructorIds = new Set((dayOverrides ?? []).map((o: any) => o.instructor_id));
  const instructors = allInstructors.filter((i: any) => !blockedInstructorIds.has(i.id));
  if (instructors.length === 0) return null;

  const dayStart = new Date(start);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(start);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const { data: dayBookings } = await supabaseAdmin
    .from("bookings")
    .select("instructor_id, scheduled_at, duration_minutes")
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .not("instructor_id", "is", null)
    .not("status", "in", "(cancelled,declined)")
    .gte("scheduled_at", dayStart.toISOString())
    .lte("scheduled_at", dayEnd.toISOString());

  // A slot with an active (unclaimed, unexpired) waitlist offer is held for
  // that student — auto-assignment must not hand it to a brand-new booking
  // out from under them. No real booking row exists for it yet, so it's
  // invisible to the query above unless merged in here explicitly.
  const { data: activeOffers } = await supabaseAdmin
    .from("waitlist_offers")
    .select("instructor_id, scheduled_at, duration_minutes")
    .eq("school_id", schoolId)
    .eq("status", "pending")
    .not("instructor_id", "is", null)
    .gt("expires_at", new Date().toISOString())
    .gte("scheduled_at", dayStart.toISOString())
    .lte("scheduled_at", dayEnd.toISOString());

  return pickBestInstructor({
    instructors: instructors ?? [],
    dayBookings: [...(dayBookings ?? []), ...(activeOffers ?? [])],
    scheduledAt,
    durationMinutes,
    femaleOnly,
  });
}

const SchoolIdSchema = z.object({ schoolId: z.string().uuid() });

// instructors has no anon-read RLS policy at all (correctly — it's staff
// data), so the public booking page can't check this directly. This
// returns nothing beyond a boolean, safe for anon.
export const getHasFemaleInstructor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SchoolIdSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("instructors")
      .select("id", { count: "exact", head: true })
      .eq("school_id", data.schoolId)
      .eq("active", true)
      .eq("is_female", true);
    return { hasFemaleInstructor: (count ?? 0) > 0 };
  });

// schedule_overrides is publicly readable (see so_public_read policy), but
// instructors isn't — this combines both server-side and returns just the
// resulting set of blocked date strings, same reasoning as
// getHasFemaleInstructor above.
export const getAppointmentOnlyDates = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SchoolIdSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const todayKey = toDateKey(new Date());
    const [{ data: overrides }, { data: instructors }] = await Promise.all([
      supabaseAdmin
        .from("schedule_overrides")
        .select("date, instructor_id")
        .eq("school_id", data.schoolId)
        .gte("date", todayKey),
      supabaseAdmin
        .from("instructors")
        .select("id")
        .eq("school_id", data.schoolId)
        .eq("active", true)
        .eq("status", "active"),
    ]);
    const dates = computeAppointmentOnlyDates(
      overrides ?? [],
      (instructors ?? []).map((i: any) => i.id),
    );
    return { appointmentOnlyDates: Array.from(dates) };
  });

export async function assertNotAppointmentOnly(
  supabaseAdmin: any,
  schoolId: string,
  scheduledAt: string,
) {
  const dateKey = toDateKey(new Date(scheduledAt));
  const { data } = await supabaseAdmin
    .from("schedule_overrides")
    .select("id")
    .eq("school_id", schoolId)
    .eq("date", dateKey)
    .is("instructor_id", null)
    .maybeSingle();
  if (data) {
    throw new Error(
      "This date is by appointment only. Please use the 'Request a time' option instead.",
    );
  }
}

export const submitPublicBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => BookingSchema.parse(data))
  .handler(async ({ data }) => {
    // Bot protection: a filled honeypot or an impossibly fast submission
    // gets a fake success — no DB writes, and no signal to the bot that
    // it was caught.
    if (isBotSubmission(data)) {
      return { ok: true, status: "pending" as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Validate the lesson type exists, is active, AND belongs to this
    // school — without this check, someone could book a lesson type
    // that belongs to a different school by tampering with the request.
    const { data: lt, error: ltErr } = await supabaseAdmin
      .from("lesson_types")
      .select("id,duration_minutes,price_cents,active,school_id,pickup_available")
      .eq("id", data.lesson_type_id)
      .eq("school_id", data.school_id)
      .maybeSingle();
    if (ltErr) throw new Error("Could not load lesson type");
    if (!lt || !lt.active) throw new Error("Invalid lesson type");

    await assertNotAppointmentOnly(supabaseAdmin, data.school_id, data.scheduled_at);

    // Rate limit: cap repeat submissions from the same email in a short
    // window so a script can't flood the booking queue.
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60000).toISOString();
    const { count: recentCount } = await supabaseAdmin
      .from("bookings")
      .select("id, students!inner(email)", { count: "exact", head: true })
      .eq("school_id", data.school_id)
      .eq("students.email", data.email)
      .gte("created_at", windowStart);
    if ((recentCount ?? 0) >= RATE_LIMIT_MAX_BOOKINGS) {
      throw new Error(
        "Too many booking requests from this email recently. Please try again later.",
      );
    }

    // Honor Approval Mode: auto-confirm when admin has disabled manual approval
    const { data: settings } = await supabaseAdmin
      .from("school_settings")
      .select("require_approval, auto_assign_instructor, booking_paused, pickup_service_areas")
      .eq("school_id", data.school_id)
      .maybeSingle();
    if (settings?.booking_paused) {
      throw new Error("This school isn't accepting new bookings right now. Please check back later.");
    }
    const initialStatus = settings?.require_approval === false ? "confirmed" : "pending";

    // Re-validate pickup on the server — the client-side check is UX, not
    // a security boundary, and a tampered request could otherwise skip it.
    let finalPickupAddress: string | null = null;
    if (lt.pickup_available) {
      if (!data.pickup_address.trim()) throw new Error("Pickup address is required.");
      if (!isValidPostalCode(data.postal_code)) throw new Error("Enter a valid postal code.");
      if (!isPickupAreaServiced(data.postal_code, settings?.pickup_service_areas ?? [])) {
        throw new Error("Sorry, this address is outside our pickup area.");
      }
      finalPickupAddress = `${data.pickup_address.trim()}, ${data.postal_code.trim().toUpperCase()}`;
    }

    const { data: student, error: sErr } = await supabaseAdmin
      .from("students")
      .insert({
        full_name: data.full_name,
        phone: data.phone,
        email: data.email,
        pickup_address: finalPickupAddress,
        notes: data.notes ?? null,
        school_id: data.school_id,
      })
      .select("id")
      .single();
    if (sErr || !student) throw new Error("Could not create student");

    const instructorId = settings?.auto_assign_instructor
      ? await pickInstructor(
          supabaseAdmin,
          data.school_id,
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
        pickup_address: finalPickupAddress,
        dropoff_address: data.dropoff_address ?? finalPickupAddress,
        notes: data.notes ?? null,
        price_cents: lt.price_cents,
        status: initialStatus,
        school_id: data.school_id,
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
  booking_id: z.string().uuid(),
  reason: z.string().min(1).max(2000),
});

export const submitPublicCancellation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CancelSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Confirm booking exists before recording the request
    const { data: b } = await supabaseAdmin
      .from("bookings")
      .select("id, school_id")
      .eq("id", data.booking_id)
      .maybeSingle();
    if (!b) throw new Error("Booking not found");

    const { error } = await supabaseAdmin.from("cancellation_requests").insert({
      booking_id: data.booking_id,
      school_id: b.school_id,
      reason: data.reason,
      status: "requested",
    });
    if (error) throw new Error("Could not submit request");
    return { ok: true };
  });
