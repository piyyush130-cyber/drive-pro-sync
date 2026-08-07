import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  RATE_LIMIT_MAX_BOOKINGS,
  RATE_LIMIT_WINDOW_MINUTES,
  isBotSubmission,
  pickBestInstructor,
} from "@/lib/booking-logic";

const BookingSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(3).max(40),
  email: z.string().trim().email().max(200),
  pickup_address: z.string().trim().min(1).max(300),
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
): Promise<string | null> {
  const { data: instructors } = await supabaseAdmin
    .from("instructors")
    .select("id, weekly_availability")
    .eq("school_id", schoolId)
    .eq("active", true)
    .eq("status", "active");
  if (!instructors || instructors.length === 0) return null;

  const start = new Date(scheduledAt);
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

  return pickBestInstructor({
    instructors: instructors ?? [],
    dayBookings: dayBookings ?? [],
    scheduledAt,
    durationMinutes,
  });
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
      .select("id,duration_minutes,price_cents,active,school_id")
      .eq("id", data.lesson_type_id)
      .eq("school_id", data.school_id)
      .maybeSingle();
    if (ltErr) throw new Error("Could not load lesson type");
    if (!lt || !lt.active) throw new Error("Invalid lesson type");

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
      .select("require_approval, auto_assign_instructor, booking_paused")
      .eq("school_id", data.school_id)
      .maybeSingle();
    if (settings?.booking_paused) {
      throw new Error("This school isn't accepting new bookings right now. Please check back later.");
    }
    const initialStatus = settings?.require_approval === false ? "confirmed" : "pending";

    const { data: student, error: sErr } = await supabaseAdmin
      .from("students")
      .insert({
        full_name: data.full_name,
        phone: data.phone,
        email: data.email,
        pickup_address: data.pickup_address,
        notes: data.notes ?? null,
        school_id: data.school_id,
      })
      .select("id")
      .single();
    if (sErr || !student) throw new Error("Could not create student");

    const instructorId = settings?.auto_assign_instructor
      ? await pickInstructor(supabaseAdmin, data.school_id, data.scheduled_at, lt.duration_minutes)
      : null;

    const { data: booking, error: bErr } = await supabaseAdmin
      .from("bookings")
      .insert({
        student_id: student.id,
        instructor_id: instructorId,
        lesson_type_id: lt.id,
        scheduled_at: data.scheduled_at,
        duration_minutes: lt.duration_minutes,
        pickup_address: data.pickup_address,
        dropoff_address: data.dropoff_address ?? data.pickup_address,
        notes: data.notes ?? null,
        price_cents: lt.price_cents,
        status: initialStatus,
        school_id: data.school_id,
      })
      .select("id")
      .single();
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
