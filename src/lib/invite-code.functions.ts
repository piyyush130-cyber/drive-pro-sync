import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateInviteCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const code = "DRIVE-" + Math.random().toString(36).toUpperCase().slice(2, 8);
    await supabaseAdmin
      .from("instructor_invite_codes")
      .update({ is_active: false })
      .eq("is_active", true);
    const { data, error } = await supabaseAdmin
      .from("instructor_invite_codes")
      .insert({ code, is_active: true, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { code: data.code };
  });

export const useInviteCode = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      code: string;
      userId: string;
      fullName: string;
      email: string;
      phone: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("instructor_invite_codes")
      .select("*")
      .eq("code", data.code.toUpperCase())
      .eq("is_active", true)
      .maybeSingle();
    if (!invite)
      throw new Error("Invalid invite code. Please contact your driving school admin.");
    if (invite.expires_at && new Date(invite.expires_at) < new Date())
      throw new Error("This invite code has expired. Ask your admin for a new one.");
    if (invite.max_uses && invite.used_count >= invite.max_uses)
      throw new Error("This invite code has reached its maximum uses.");

    await supabaseAdmin.from("profiles").upsert(
      { id: data.userId, email: data.email, full_name: data.fullName },
      { onConflict: "id" },
    );
    await supabaseAdmin.from("instructors").insert({
      profile_id: data.userId,
      full_name: data.fullName,
      email: data.email,
      phone: data.phone,
      active: false,
      status: "pending_approval",
      invite_code_used: invite.code,
    });
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: data.userId, role: "instructor" },
        { onConflict: "user_id,role" },
      );
    await supabaseAdmin
      .from("instructor_invite_codes")
      .update({ used_count: invite.used_count + 1 })
      .eq("id", invite.id);
    return { success: true };
  });
