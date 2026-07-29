import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const notifyBookingUpdated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bookingId: string; patch: Record<string, unknown> }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifyBookingStatusChange } = await import("@/lib/notifications.server");
    await notifyBookingStatusChange(supabaseAdmin, { bookingId: data.bookingId }, data.patch);
    return { ok: true };
  });
