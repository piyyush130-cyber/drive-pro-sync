import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Schema = z.object({
  instructorId: z.string().uuid().optional(),
  reason: z.string().trim().min(1).max(300),
});

// Bulk-cancels every not-yet-resolved booking scheduled for today, either
// for one instructor (sick day) or the whole school (weather closure), and
// notifies each affected student the same way a single cancellation does.
export const cancelTodayBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Schema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("school_id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden");
    const schoolId = roleRow.school_id;

    if (data.instructorId) {
      const { data: instructor } = await context.supabase
        .from("instructors")
        .select("id")
        .eq("id", data.instructorId)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (!instructor) throw new Error("Instructor not found");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 86400000);

    let q = supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("school_id", schoolId)
      .is("deleted_at", null)
      .not("status", "in", "(cancelled,declined,completed,no_show)")
      .gte("scheduled_at", start.toISOString())
      .lt("scheduled_at", end.toISOString());
    if (data.instructorId) q = q.eq("instructor_id", data.instructorId);

    const { data: bookings, error } = await q;
    if (error) throw new Error("Could not load today's bookings");
    if (!bookings || bookings.length === 0) return { count: 0 };

    const ids = bookings.map((b: { id: string }) => b.id);
    const { error: updErr } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled" })
      .in("id", ids);
    if (updErr) throw new Error("Could not cancel bookings");

    const { notifyBookingStatusChange } = await import("@/lib/notifications.server");
    for (const id of ids) {
      await notifyBookingStatusChange(
        supabaseAdmin,
        { bookingId: id },
        { status: "cancelled", cancellation_reason: data.reason },
      );
    }

    return { count: ids.length };
  });
