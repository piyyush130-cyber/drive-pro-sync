import { hashToken } from "@/lib/student-portal-token.server";

export const LOGIN_LINK_TTL_MS = 15 * 60000; // 15 minutes
export const SESSION_TTL_MS = 30 * 86400000; // 30 days, fixed — not extended by use
export const LOGIN_RATE_LIMIT_WINDOW_MINUTES = 10;
export const LOGIN_RATE_LIMIT_MAX = 3;

// Validates a student portal session token server-side and returns the
// identity it was issued for. Every portal server function calls this
// first, then proceeds via supabaseAdmin scoped to the returned student_id
// — mirrors requireSupabaseAuth's role in the staff-facing app, but checks
// against student_sessions instead of a Supabase Auth JWT (see the schema
// migration for why students don't use real Supabase Auth accounts).
export async function requireStudentSession(
  supabaseAdmin: any,
  sessionToken: string | undefined | null,
): Promise<{ studentId: string; schoolId: string; sessionId: string }> {
  if (!sessionToken) throw new Error("Not signed in.");
  const tokenHash = hashToken(sessionToken);
  const { data: session } = await supabaseAdmin
    .from("student_sessions")
    .select("id, student_id, school_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) {
    throw new Error("Your session has expired. Please log in again.");
  }
  // Best-effort activity timestamp — never block the request on it.
  void supabaseAdmin
    .from("student_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", session.id)
    .then(() => {});
  return { studentId: session.student_id, schoolId: session.school_id, sessionId: session.id };
}
