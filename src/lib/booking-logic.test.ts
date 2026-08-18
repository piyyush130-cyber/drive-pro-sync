import { describe, it, expect } from "vitest";
import {
  isBotSubmission,
  pickBestInstructor,
  listEligibleInstructors,
  hasVehicleConflict,
  MIN_FILL_TIME_MS,
} from "./booking-logic";

describe("isBotSubmission", () => {
  it("flags a filled honeypot", () => {
    expect(isBotSubmission({ website: "http://spam.example" })).toBe(true);
  });

  it("flags a submission faster than the minimum fill time", () => {
    const now = 1_000_000;
    const renderedAt = now - (MIN_FILL_TIME_MS - 1);
    expect(isBotSubmission({ formRenderedAt: renderedAt }, now)).toBe(true);
  });

  it("allows a real submission with an empty honeypot and a plausible fill time", () => {
    const now = 1_000_000;
    const renderedAt = now - (MIN_FILL_TIME_MS + 5000);
    expect(isBotSubmission({ website: "", formRenderedAt: renderedAt }, now)).toBe(false);
  });

  it("allows a submission with no timing data at all", () => {
    expect(isBotSubmission({})).toBe(false);
  });
});

describe("pickBestInstructor", () => {
  const MONDAY_9AM = "2026-08-03T09:00:00.000Z"; // 2026-08-03 is a Monday

  it("returns null when no instructor is available that day", () => {
    const result = pickBestInstructor({
      instructors: [{ id: "a", weekly_availability: { monday: { enabled: false } } }],
      dayBookings: [],
      scheduledAt: MONDAY_9AM,
      durationMinutes: 60,
    });
    expect(result).toBeNull();
  });

  it("skips an instructor whose hours don't cover the requested slot", () => {
    const result = pickBestInstructor({
      instructors: [
        {
          id: "a",
          weekly_availability: { monday: { enabled: true, start: "13:00", end: "17:00" } },
        },
      ],
      dayBookings: [],
      scheduledAt: MONDAY_9AM,
      durationMinutes: 60,
    });
    expect(result).toBeNull();
  });

  it("picks an available instructor with no conflicts", () => {
    const result = pickBestInstructor({
      instructors: [
        {
          id: "a",
          weekly_availability: { monday: { enabled: true, start: "09:00", end: "17:00" } },
        },
      ],
      dayBookings: [],
      scheduledAt: MONDAY_9AM,
      durationMinutes: 60,
    });
    expect(result).toBe("a");
  });

  it("skips an instructor with an overlapping booking", () => {
    const result = pickBestInstructor({
      instructors: [
        {
          id: "a",
          weekly_availability: { monday: { enabled: true, start: "09:00", end: "17:00" } },
        },
      ],
      dayBookings: [{ instructor_id: "a", scheduled_at: MONDAY_9AM, duration_minutes: 60 }],
      scheduledAt: MONDAY_9AM,
      durationMinutes: 60,
    });
    expect(result).toBeNull();
  });

  it("prefers the instructor with fewer bookings that day", () => {
    const result = pickBestInstructor({
      instructors: [
        {
          id: "busy",
          weekly_availability: { monday: { enabled: true, start: "09:00", end: "17:00" } },
        },
        {
          id: "free",
          weekly_availability: { monday: { enabled: true, start: "09:00", end: "17:00" } },
        },
      ],
      dayBookings: [
        { instructor_id: "busy", scheduled_at: "2026-08-03T11:00:00.000Z", duration_minutes: 60 },
        { instructor_id: "busy", scheduled_at: "2026-08-03T13:00:00.000Z", duration_minutes: 60 },
      ],
      scheduledAt: MONDAY_9AM,
      durationMinutes: 60,
    });
    expect(result).toBe("free");
  });

  it("with femaleOnly, skips a non-female instructor even if otherwise available", () => {
    const result = pickBestInstructor({
      instructors: [
        {
          id: "a",
          weekly_availability: { monday: { enabled: true, start: "09:00", end: "17:00" } },
          is_female: false,
        },
      ],
      dayBookings: [],
      scheduledAt: MONDAY_9AM,
      durationMinutes: 60,
      femaleOnly: true,
    });
    expect(result).toBeNull();
  });

  it("with femaleOnly, picks a matching instructor and ignores a non-matching one", () => {
    const result = pickBestInstructor({
      instructors: [
        {
          id: "male",
          weekly_availability: { monday: { enabled: true, start: "09:00", end: "17:00" } },
          is_female: false,
        },
        {
          id: "female",
          weekly_availability: { monday: { enabled: true, start: "09:00", end: "17:00" } },
          is_female: true,
        },
      ],
      dayBookings: [],
      scheduledAt: MONDAY_9AM,
      durationMinutes: 60,
      femaleOnly: true,
    });
    expect(result).toBe("female");
  });

  it("without femaleOnly, is_female has no effect on selection", () => {
    const result = pickBestInstructor({
      instructors: [
        {
          id: "a",
          weekly_availability: { monday: { enabled: true, start: "09:00", end: "17:00" } },
          is_female: false,
        },
      ],
      dayBookings: [],
      scheduledAt: MONDAY_9AM,
      durationMinutes: 60,
    });
    expect(result).toBe("a");
  });
});

describe("listEligibleInstructors", () => {
  const MONDAY_9AM = "2026-08-03T09:00:00.000Z";

  it("returns an empty array when nobody is available", () => {
    const result = listEligibleInstructors({
      instructors: [{ id: "a", weekly_availability: { monday: { enabled: false } } }],
      dayBookings: [],
      scheduledAt: MONDAY_9AM,
      durationMinutes: 60,
    });
    expect(result).toEqual([]);
  });

  it("returns all eligible instructors sorted least-loaded first", () => {
    const avail = { monday: { enabled: true, start: "09:00", end: "17:00" } };
    const result = listEligibleInstructors({
      instructors: [
        { id: "busy", weekly_availability: avail },
        { id: "free", weekly_availability: avail },
      ],
      dayBookings: [
        { instructor_id: "busy", scheduled_at: "2026-08-03T13:00:00.000Z", duration_minutes: 60 },
      ],
      scheduledAt: MONDAY_9AM,
      durationMinutes: 60,
    });
    expect(result.map((r) => r.id)).toEqual(["free", "busy"]);
  });

  it("excludes an instructor with a conflicting booking that day", () => {
    const avail = { monday: { enabled: true, start: "09:00", end: "17:00" } };
    const result = listEligibleInstructors({
      instructors: [{ id: "a", weekly_availability: avail }],
      dayBookings: [
        { instructor_id: "a", scheduled_at: MONDAY_9AM, duration_minutes: 60 },
      ],
      scheduledAt: MONDAY_9AM,
      durationMinutes: 60,
    });
    expect(result).toEqual([]);
  });

  it("respects femaleOnly", () => {
    const avail = { monday: { enabled: true, start: "09:00", end: "17:00" } };
    const result = listEligibleInstructors({
      instructors: [
        { id: "a", weekly_availability: avail, is_female: false },
        { id: "b", weekly_availability: avail, is_female: true },
      ],
      dayBookings: [],
      scheduledAt: MONDAY_9AM,
      durationMinutes: 60,
      femaleOnly: true,
    });
    expect(result.map((r) => r.id)).toEqual(["b"]);
  });
});

describe("hasVehicleConflict", () => {
  const MONDAY_9AM = "2026-08-03T09:00:00.000Z";

  it("returns false when the vehicle has no bookings that overlap", () => {
    const result = hasVehicleConflict({
      vehicleId: "car-1",
      dayBookings: [
        { id: "b1", vehicle_id: "car-1", scheduled_at: "2026-08-03T13:00:00.000Z", duration_minutes: 60 },
      ],
      scheduledAt: MONDAY_9AM,
      durationMinutes: 60,
    });
    expect(result).toBe(false);
  });

  it("returns true when another booking overlaps the same vehicle", () => {
    const result = hasVehicleConflict({
      vehicleId: "car-1",
      dayBookings: [
        { id: "b1", vehicle_id: "car-1", scheduled_at: MONDAY_9AM, duration_minutes: 60 },
      ],
      scheduledAt: MONDAY_9AM,
      durationMinutes: 60,
    });
    expect(result).toBe(true);
  });

  it("ignores bookings for a different vehicle", () => {
    const result = hasVehicleConflict({
      vehicleId: "car-1",
      dayBookings: [
        { id: "b1", vehicle_id: "car-2", scheduled_at: MONDAY_9AM, duration_minutes: 60 },
      ],
      scheduledAt: MONDAY_9AM,
      durationMinutes: 60,
    });
    expect(result).toBe(false);
  });

  it("excludes the booking's own existing assignment", () => {
    const result = hasVehicleConflict({
      vehicleId: "car-1",
      dayBookings: [
        { id: "b1", vehicle_id: "car-1", scheduled_at: MONDAY_9AM, duration_minutes: 60 },
      ],
      scheduledAt: MONDAY_9AM,
      durationMinutes: 60,
      excludeBookingId: "b1",
    });
    expect(result).toBe(false);
  });
});
