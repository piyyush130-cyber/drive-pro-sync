import { addDays, endOfMonth, startOfMonth, startOfWeek } from "date-fns";

// Shared scheduling rules between the main public booking widget
// ($schoolSlug.tsx) and the token-scoped next-lesson booking page, so both
// entry points genuinely offer the same slots rather than two independent
// implementations that could drift.
export const TIME_SLOTS: { time: string; label: string }[] = [
  { time: "08:00", label: "8:00 AM" },
  { time: "09:30", label: "9:30 AM" },
  { time: "11:00", label: "11:00 AM" },
  { time: "12:30", label: "12:30 PM" },
  { time: "14:00", label: "2:00 PM" },
  { time: "15:30", label: "3:30 PM" },
  { time: "17:00", label: "5:00 PM" },
  { time: "18:30", label: "6:30 PM" },
  { time: "20:00", label: "8:00 PM" },
  { time: "21:00", label: "9:00 PM" },
];

export function unavailableForDate(d: Date): Set<string> {
  const seed = (d.getFullYear() * 1000 + d.getMonth() * 50 + d.getDate()) % 7;
  const blocked = new Set<string>();
  if (d.getDay() === 0) {
    blocked.add("08:00");
    blocked.add("09:30");
  }
  blocked.add(TIME_SLOTS[seed % TIME_SLOTS.length].time);
  blocked.add(TIME_SLOTS[(seed + 3) % TIME_SLOTS.length].time);
  return blocked;
}

export function buildMonthGrid(month: Date): Date[] {
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const last = endOfMonth(month);
  const days: Date[] = [];
  let cur = first;
  while (cur <= addDays(last, 6 - last.getDay())) {
    days.push(cur);
    cur = addDays(cur, 1);
    if (days.length > 42) break;
  }
  return days;
}
