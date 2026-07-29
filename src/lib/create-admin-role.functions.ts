import { createServerFn } from "@tanstack/react-start";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "school"}-${suffix}`;
}

export const createAdminRole = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string; fullName: string; schoolName?: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Every public signup on /auth becomes the admin of a brand new
    // school. Instructors join an existing school via /instructor-signup
    // with an invite code instead — they never land here.
    const schoolName = data.schoolName?.trim() || "My Driving School";
    const { data: school, error: schoolErr } = await supabaseAdmin
      .from("schools")
      .insert({ name: schoolName, slug: slugify(schoolName) })
      .select("id")
      .single();
    if (schoolErr || !school) throw new Error(schoolErr?.message || "Could not create school");

    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: data.userId, role: "admin", school_id: school.id },
        { onConflict: "user_id,school_id,role" },
      );

    await supabaseAdmin.from("school_settings").insert({
      school_id: school.id,
      school_name: schoolName,
      onboarding_complete: false,
    });

    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName })
      .eq("id", data.userId);

    return { role: "admin" as const, schoolId: school.id };
  });
