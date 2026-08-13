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

// Hour-based balance for schools with flexible_session_length_enabled — kept
// entirely separate from lessons_purchased/remainingLessons above, which
// stays lesson-count based and unaffected. Only 'package' category bookings
// draw against this pool, since a 10-hour package split as 2x5hr sessions
// vs 10x1hr sessions has the same total hours but very different lesson
// counts, making count-based tracking meaningless here.
export async function remainingPackageHours(supabaseAdmin: any, studentId: string): Promise<number> {
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("package_hours_purchased")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return 0;
  const { data: completed } = await supabaseAdmin
    .from("bookings")
    .select("duration_minutes, lesson_types!inner(category)")
    .eq("student_id", studentId)
    .eq("status", "completed")
    .eq("lesson_types.category", "package");
  const usedMinutes = (completed ?? []).reduce(
    (sum: number, b: any) => sum + (b.duration_minutes ?? 0),
    0,
  );
  return Math.max(0, (student.package_hours_purchased ?? 0) - usedMinutes / 60);
}
