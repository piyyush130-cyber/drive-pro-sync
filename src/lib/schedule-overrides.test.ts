import { describe, it, expect } from "vitest";
import { computeAppointmentOnlyDates, toDateKey } from "./schedule-overrides";

describe("computeAppointmentOnlyDates", () => {
  it("includes a school-wide override date directly", () => {
    const result = computeAppointmentOnlyDates(
      [{ date: "2026-09-01", instructor_id: null }],
      ["inst-1", "inst-2"],
    );
    expect(result.has("2026-09-01")).toBe(true);
  });

  it("does not block a date when only some instructors are individually overridden", () => {
    const result = computeAppointmentOnlyDates(
      [{ date: "2026-09-02", instructor_id: "inst-1" }],
      ["inst-1", "inst-2"],
    );
    expect(result.has("2026-09-02")).toBe(false);
  });

  it("blocks a date when every active instructor is individually overridden", () => {
    const result = computeAppointmentOnlyDates(
      [
        { date: "2026-09-03", instructor_id: "inst-1" },
        { date: "2026-09-03", instructor_id: "inst-2" },
      ],
      ["inst-1", "inst-2"],
    );
    expect(result.has("2026-09-03")).toBe(true);
  });

  it("does not block a date via per-instructor overrides when there are no active instructors", () => {
    const result = computeAppointmentOnlyDates(
      [{ date: "2026-09-04", instructor_id: "inst-1" }],
      [],
    );
    expect(result.has("2026-09-04")).toBe(false);
  });

  it("leaves unrelated dates unblocked", () => {
    const result = computeAppointmentOnlyDates(
      [{ date: "2026-09-01", instructor_id: null }],
      ["inst-1"],
    );
    expect(result.has("2026-09-05")).toBe(false);
  });
});

describe("toDateKey", () => {
  it("formats as YYYY-MM-DD in local time", () => {
    expect(toDateKey(new Date(2026, 8, 5))).toBe("2026-09-05");
  });

  it("pads single-digit months and days", () => {
    expect(toDateKey(new Date(2026, 0, 3))).toBe("2026-01-03");
  });
});
