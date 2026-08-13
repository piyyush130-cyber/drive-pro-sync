export const MIN_FILL_TIME_MS = 3000;
export const RATE_LIMIT_WINDOW_MINUTES = 10;
export const RATE_LIMIT_MAX_BOOKINGS = 3;

// A filled honeypot or an impossibly fast submission indicates a bot, not a
// real visitor filling out a multi-field form.
export function isBotSubmission(
  input: { website?: string; formRenderedAt?: number },
  now = Date.now(),
): boolean {
  const tooFast =
    typeof input.formRenderedAt === "number" && now - input.formRenderedAt < MIN_FILL_TIME_MS;
  return !!input.website || tooFast;
}

export const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type WeeklyAvailability = Partial<
  Record<(typeof DAY_KEYS)[number], { enabled?: boolean; start?: string; end?: string }>
>;

export type InstructorCandidate = {
  id: string;
  weekly_availability: WeeklyAvailability | null;
  is_female?: boolean;
};
export type DayBooking = { instructor_id: string; scheduled_at: string; duration_minutes: number };

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Picks the least-loaded instructor whose weekly_availability covers the
// requested slot and who has no overlapping booking that day. Pure — takes
// already-fetched candidates and that day's bookings, does no I/O itself.
export function pickBestInstructor(input: {
  instructors: InstructorCandidate[];
  dayBookings: DayBooking[];
  scheduledAt: string;
  durationMinutes: number;
  femaleOnly?: boolean;
}): string | null {
  const { instructors, dayBookings, scheduledAt, durationMinutes, femaleOnly } = input;
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const dayKey = DAY_KEYS[start.getUTCDay()];
  const minutesOfDay = start.getUTCHours() * 60 + start.getUTCMinutes();

  let best: { id: string; load: number } | null = null;
  for (const inst of instructors) {
    if (femaleOnly && !inst.is_female) continue;
    const avail = inst.weekly_availability ?? {};
    const day = avail[dayKey];
    if (!day?.enabled || !day.start || !day.end) continue;
    if (
      minutesOfDay < timeToMinutes(day.start) ||
      minutesOfDay + durationMinutes > timeToMinutes(day.end)
    ) {
      continue;
    }

    const instBookings = dayBookings.filter((b) => b.instructor_id === inst.id);
    const conflicts = instBookings.some((b) => {
      const bStart = new Date(b.scheduled_at);
      const bEnd = new Date(bStart.getTime() + b.duration_minutes * 60000);
      return start < bEnd && end > bStart;
    });
    if (conflicts) continue;

    if (!best || instBookings.length < best.load) {
      best = { id: inst.id, load: instBookings.length };
    }
  }
  return best?.id ?? null;
}

export type VehicleBooking = {
  id: string;
  vehicle_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
};

// True if assigning `vehicleId` to a lesson at [scheduledAt, +durationMinutes]
// would overlap another booking already using that vehicle. `excludeBookingId`
// lets a booking check against everyone else's schedule without conflicting
// with its own existing assignment when reassigning.
export function hasVehicleConflict(input: {
  vehicleId: string;
  dayBookings: VehicleBooking[];
  scheduledAt: string;
  durationMinutes: number;
  excludeBookingId?: string;
}): boolean {
  const { vehicleId, dayBookings, scheduledAt, durationMinutes, excludeBookingId } = input;
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return dayBookings.some((b) => {
    if (b.vehicle_id !== vehicleId) return false;
    if (excludeBookingId && b.id === excludeBookingId) return false;
    const bStart = new Date(b.scheduled_at);
    const bEnd = new Date(bStart.getTime() + b.duration_minutes * 60000);
    return start < bEnd && end > bStart;
  });
}
