// Postgres exclusion-constraint violation (SQLSTATE 23P01) — thrown by the
// no_overlapping_instructor_bookings / no_overlapping_vehicle_bookings
// constraints when a write would double-book a resource. Checked by both
// server functions (supabaseAdmin errors) and client-side admin actions
// (RLS-scoped supabase errors), which share the same error shape.
const EXCLUSION_VIOLATION = "23P01";

export function isBookingConflictError(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as any).code === EXCLUSION_VIOLATION;
}

export const BOOKING_CONFLICT_MESSAGE =
  "This time slot was just taken. Please pick another time.";
