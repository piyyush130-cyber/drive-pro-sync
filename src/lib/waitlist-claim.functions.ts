import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hashToken } from "@/lib/student-portal-token.server";
import { isBookingConflictError } from "@/lib/booking-conflict-error";

const TokenSchema = z.object({ token: z.string().min(20) });

// Public — resolves a waitlist claim token to just enough for the claim
// page to render: when the slot is, who's teaching, and how much it costs.
export const getWaitlistOffer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = hashToken(data.token);

    const { data: offer } = await supabaseAdmin
      .from("waitlist_offers")
      .select(
        "id, status, expires_at, scheduled_at, school_id, waitlist_entry_id, " +
          "instructors(full_name), lesson_types(name, price_cents)",
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!offer) throw new Error("This offer is no longer valid.");
    if (offer.status !== "pending") throw new Error("This offer has already been claimed.");
    if (new Date(offer.expires_at) < new Date()) throw new Error("This offer has expired.");

    const { data: entry } = await supabaseAdmin
      .from("waitlist_entries")
      .select("student_id")
      .eq("id", offer.waitlist_entry_id)
      .maybeSingle();
    const [{ data: student }, { data: school }] = await Promise.all([
      supabaseAdmin
        .from("students")
        .select("full_name")
        .eq("id", entry?.student_id)
        .maybeSingle(),
      supabaseAdmin
        .from("school_settings")
        .select("school_name")
        .eq("school_id", offer.school_id)
        .maybeSingle(),
    ]);

    return {
      firstName: student?.full_name?.split(" ")[0] || "there",
      schoolName: school?.school_name ?? "your driving school",
      instructorName: (offer as any).instructors?.full_name ?? null,
      lessonTypeName: (offer as any).lesson_types?.name ?? "Driving lesson",
      priceCents: (offer as any).lesson_types?.price_cents ?? 0,
      scheduledAt: offer.scheduled_at,
    };
  });

export const claimWaitlistOffer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = hashToken(data.token);

    // Atomic single-use redemption, same pattern as student login links —
    // a plain SELECT-then-UPDATE would let two students who both received
    // the link (there's only ever one, but defense in depth) or a
    // double-click race past the pending check.
    const { data: offer, error } = await supabaseAdmin
      .from("waitlist_offers")
      .update({ status: "claimed" })
      .eq("token_hash", tokenHash)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .select("*")
      .maybeSingle();
    if (error || !offer) {
      throw new Error("This offer is no longer available — it may have expired or been claimed.");
    }

    // Re-verify the instructor is still free at that time — an admin could
    // have manually filled the slot in the meantime.
    const start = new Date(offer.scheduled_at);
    const end = new Date(start.getTime() + offer.duration_minutes * 60000);
    const dayStart = new Date(start);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const { data: dayBookings } = await supabaseAdmin
      .from("bookings")
      .select("scheduled_at, duration_minutes")
      .eq("instructor_id", offer.instructor_id)
      .is("deleted_at", null)
      .not("status", "in", "(cancelled,declined)")
      .gte("scheduled_at", dayStart.toISOString())
      .lt("scheduled_at", dayEnd.toISOString());
    const conflict = (dayBookings ?? []).some((b: any) => {
      const bStart = new Date(b.scheduled_at);
      const bEnd = new Date(bStart.getTime() + b.duration_minutes * 60000);
      return start < bEnd && end > bStart;
    });
    if (conflict) {
      await supabaseAdmin.from("waitlist_offers").update({ status: "expired" }).eq("id", offer.id);
      throw new Error("Sorry, this slot was just filled another way.");
    }

    const { data: entry } = await supabaseAdmin
      .from("waitlist_entries")
      .select("student_id")
      .eq("id", offer.waitlist_entry_id)
      .maybeSingle();
    if (!entry) throw new Error("This offer is no longer valid.");

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, pickup_address")
      .eq("id", entry.student_id)
      .maybeSingle();
    if (!student) throw new Error("This offer is no longer valid.");

    const { data: lt } = await supabaseAdmin
      .from("lesson_types")
      .select("price_cents")
      .eq("id", offer.lesson_type_id)
      .maybeSingle();

    const { data: booking, error: bErr } = await supabaseAdmin
      .from("bookings")
      .insert({
        student_id: student.id,
        instructor_id: offer.instructor_id,
        lesson_type_id: offer.lesson_type_id,
        scheduled_at: offer.scheduled_at,
        duration_minutes: offer.duration_minutes,
        pickup_address: student.pickup_address,
        dropoff_address: student.pickup_address,
        price_cents: lt?.price_cents ?? 0,
        status: "pending",
        school_id: offer.school_id,
      })
      .select("id")
      .single();
    if (bErr && isBookingConflictError(bErr)) {
      await supabaseAdmin.from("waitlist_offers").update({ status: "expired" }).eq("id", offer.id);
      throw new Error("Sorry, this slot was just filled another way.");
    }
    if (bErr || !booking) throw new Error("Could not book this lesson.");

    await supabaseAdmin
      .from("waitlist_entries")
      .update({ status: "claimed" })
      .eq("id", offer.waitlist_entry_id);

    const { notifyBookingCreated } = await import("@/lib/notifications.server");
    await notifyBookingCreated(supabaseAdmin, { bookingId: booking.id });

    return { ok: true };
  });
