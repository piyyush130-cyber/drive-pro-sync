// A school-wide override (instructor_id null) blocks a date outright. A
// per-instructor override only blocks that one instructor from
// auto-assignment — but if every active instructor ends up individually
// blocked on the same date, there's nobody left to assign, so that date is
// treated as effectively appointment-only too. Pure — no I/O, easy to test.
export function computeAppointmentOnlyDates(
  overrides: { date: string; instructor_id: string | null }[],
  activeInstructorIds: string[],
): Set<string> {
  const wholeSchool = new Set<string>();
  const perDateInstructors = new Map<string, Set<string>>();

  for (const o of overrides) {
    if (!o.instructor_id) {
      wholeSchool.add(o.date);
    } else {
      if (!perDateInstructors.has(o.date)) perDateInstructors.set(o.date, new Set());
      perDateInstructors.get(o.date)!.add(o.instructor_id);
    }
  }

  if (activeInstructorIds.length > 0) {
    for (const [date, blocked] of perDateInstructors) {
      if (activeInstructorIds.every((id) => blocked.has(id))) {
        wholeSchool.add(date);
      }
    }
  }

  return wholeSchool;
}

// YYYY-MM-DD in local time — matches the DATE column's serialized form and
// avoids UTC-shift-by-a-day bugs from toISOString() on evening bookings.
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
