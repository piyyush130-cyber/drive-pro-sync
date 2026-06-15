import { createServerFn } from "@tanstack/react-start";

// Idempotent seeder. Creates demo admin + instructor accounts and ensures roles.
export const seedDemoAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  async function ensureUser(email: string, password: string, fullName: string) {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    let user = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error) throw new Error(error.message);
      user = data.user!;
    }
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: user.id, email, full_name: fullName }, { onConflict: "id" });
    return user.id;
  }

  const adminId = await ensureUser("admin@demo.com", "Demo12345", "Demo Admin");
  const instId = await ensureUser("instructor@demo.com", "Demo12345", "Demo Instructor");

  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: adminId, role: "admin" }, { onConflict: "user_id,role" });
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: instId, role: "instructor" }, { onConflict: "user_id,role" });

  // Link instructor profile if present, else create
  const { data: existing } = await supabaseAdmin
    .from("instructors")
    .select("id")
    .eq("profile_id", instId)
    .maybeSingle();
  if (!existing) {
    await supabaseAdmin.from("instructors").insert({
      profile_id: instId,
      full_name: "Demo Instructor",
      email: "instructor@demo.com",
      active: true,
    });
  }

  return { ok: true };
});
