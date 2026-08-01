import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { studentId: string }) => d)
  .handler(async ({ data, context }) => {
    // Confirm the caller is an admin for this student's school before using
    // the service role to send on their behalf.
    const { data: student } = await context.supabase
      .from("students")
      .select("school_id")
      .eq("id", data.studentId)
      .maybeSingle();
    if (!student) throw new Error("Student not found");
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("school_id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .eq("school_id", student.school_id)
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendLessonInvitation } = await import("@/lib/lesson-invitations.server");
    const request = getRequest();
    const origin = `${new URL(request.url).protocol}//${new URL(request.url).host}`;

    const result = await sendLessonInvitation(supabaseAdmin, { studentId: data.studentId, origin });
    if (!result.ok) throw new Error(result.reason);
    return { ok: true };
  });

export const getLatestInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { studentId: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invitation } = await supabaseAdmin
      .from("lesson_invitations")
      .select("status, sent_at, reminder_sent_at, booked_at")
      .eq("student_id", data.studentId)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return invitation ?? null;
  });
