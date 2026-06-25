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
});

export const submitPublicBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => BookingSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Validate lesson type exists & is active; trust server price/duration
    const { data: lt, error: ltErr } = await supabaseAdmin
      .from("lesson_types")
      .select("id,duration_minutes,price_cents,active")
      .eq("id", data.lesson_type_id)
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
      })
      .select("id")
      .single();
    if (sErr || !student) throw new Error("Could not create student");

    const { error: bErr } = await supabaseAdmin.from("bookings").insert({
      student_id: student.id,
      lesson_type_id: lt.id,
      scheduled_at: data.scheduled_at,
      duration_minutes: lt.duration_minutes,
      pickup_address: data.pickup_address,
      dropoff_address: data.dropoff_address ?? data.pickup_address,
      notes: data.notes ?? null,
      price_cents: lt.price_cents,
      status: "pending",
    });
    if (bErr) throw new Error("Could not create booking");

    return { ok: true };
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
