import { createServerFn } from "@tanstack/react-start";

export const createAdminRole = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string; schoolName: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) === 0) {
      await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: "admin" });
      await supabaseAdmin
        .from("school_settings")
        .upsert({ id: 1, school_name: data.schoolName });
      return { role: "admin" as const };
    }
    return { role: "none" as const };
  });
