import { createServerFn } from "@tanstack/react-start";

/**
 * If no admin user exists yet, promote the calling user to admin and
 * ensure a school_settings row exists. Safe to call multiple times.
 */
export const claimAdminIfFirst = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if ((count ?? 0) > 0) {
      return { claimed: false, reason: "admin_exists" as const };
    }

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });

    const { data: existing } = await supabaseAdmin
      .from("school_settings")
      .select("id")
      .eq("id", 1)
      .maybeSingle();
    if (!existing) {
      await supabaseAdmin.from("school_settings").insert({
        id: 1,
        school_name: "My Driving School",
        onboarding_complete: false,
      });
    }

    return { claimed: true };
  });
