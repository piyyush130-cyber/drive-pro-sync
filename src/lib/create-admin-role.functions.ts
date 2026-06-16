import { createServerFn } from "@tanstack/react-start";

export const createAdminRole = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string; fullName: string; schoolName?: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Every public signup on /auth is the school admin. Instructors use /instructor-signup with an invite code.
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
    // Ensure a school_settings row exists so onboarding has something to update.
    const { data: existing } = await supabaseAdmin
      .from("school_settings")
      .select("id, school_name")
      .eq("id", 1)
      .maybeSingle();
    if (!existing) {
      await supabaseAdmin.from("school_settings").insert({
        id: 1,
        school_name: data.schoolName?.trim() || "My Driving School",
        onboarding_complete: false,
      });
    } else if (data.schoolName?.trim()) {
      await supabaseAdmin
        .from("school_settings")
        .update({ school_name: data.schoolName.trim() })
        .eq("id", 1);
    }
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName })
      .eq("id", data.userId);
    return { role: "admin" as const };
  });
