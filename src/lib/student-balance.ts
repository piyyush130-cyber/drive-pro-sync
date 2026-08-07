// Shared lesson-package balance logic — previously duplicated across
// lesson-invitations.server.ts, token-booking.functions.ts, and
// students.$id.tsx. No server-only imports here (supabaseAdmin is passed
// in, not imported), so this is safe to use from client or server code.

export function computeRemaining(
  purchased: number | null | undefined,
  completed: number | null | undefined,
): number {
  return Math.max(0, (purchased ?? 0) - (completed ?? 0));
}

export async function remainingLessons(supabaseAdmin: any, studentId: string): Promise<number> {
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("lessons_purchased")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return 0;
  const { count } = await supabaseAdmin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("status", "completed");
  return computeRemaining(student.lessons_purchased, count);
}
