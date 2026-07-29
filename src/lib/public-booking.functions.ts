import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
});

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

type WeeklyAvailability = Partial<
  Record<(typeof DAY_KEYS)[number], { enabled?: boolean; start?: string; end?: string }>
>;

// Picks an active instructor who is available (per weekly_availability) for
// the requested slot and has no overlapping booking, preferring whoever has
// the fewest bookings that day. Returns null if no one qualifies — the
// booking is still created, just unassigned, same as manual-assign mode.
async function pickInstructor(
  supabaseAdmin: any,
  schoolId: string,
  scheduledAt: string,
  durationMinutes: number,
): Promise<string | null> {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const dayKey = DAY_KEYS[start.getUTCDay()];
  const minutesOfDay = start.getUTCHours() * 60 + start.getUTCMinutes();

  const { data: instructors } = await supabaseAdmin
    .from("instructors")
    .select("id, weekly_availability")
    .eq("school_id", schoolId)
    .eq("active", true)
    .eq("status", "active");
  if (!instructors || instructors.length === 0) return null;

  const dayStart = new Date(start);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(start);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const { data: dayBookings } = await supabaseAdmin
    .from("bookings")
    .select("instructor_id, scheduled_at, duration_minutes")
    .eq("school_id", schoolId)
    .not("instructor_id", "is", null)
    .not("status", "in", "(cancelled,declined)")
    .gte("scheduled_at", dayStart.toISOString())
    .lte("scheduled_at", dayEnd.toISOString());

  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  let best: { id: string; load: number } | null = null;
  for (const inst of instructors) {
    const avail = (inst.weekly_availability ?? {}) as WeeklyAvailability;
    const day = avail[dayKey];
    if (!day?.enabled || !day.start || !day.end) continue;
    if (
      minutesOfDay < timeToMinutes(day.start) ||
      minutesOfDay + durationMinutes > timeToMinutes(day.end)
    ) {
      continue;
    }

    const instBookings = (dayBookings ?? []).filter((b: any) => b.instructor_id === inst.id);
    const conflicts = instBookings.some((b: any) => {
      const bStart = new Date(b.scheduled_at);
      const bEnd = new Date(bStart.getTime() + b.duration_minutes * 60000);
      return start < bEnd && end > bStart;
    });
    if (conflicts) continue;

    if (!best || instBookings.length < best.load) {
      best = { id: inst.id, load: instBookings.length };
    }
  }
  return best?.id ?? null;
}

export const submitPublicBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => BookingSchema.parse(data))
  .handler(async ({ data }) => {
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

    // Honor Approval Mode: auto-confirm when admin has disabled manual approval
    const { data: settings } = await supabaseAdmin
      .from("school_settings")
      .select("require_approval, auto_assign_instructor")
      .eq("school_id", data.school_id)
      .maybeSingle();
    const initialStatus = settings?.require_approval === false ? "confirmed" : "pending";

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
      .select("id")
      .eq("id", data.booking_id)
      .maybeSingle();
    if (!b) throw new Error("Booking not found");

    const { error } = await supabaseAdmin.from("cancellation_requests").insert({
      booking_id: data.booking_id,
      reason: data.reason,
      status: "requested",
    });
    if (error) throw new Error("Could not submit request");
    return { ok: true };
  });
