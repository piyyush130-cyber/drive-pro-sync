import { describe, it, expect } from "vitest";
import { computeCancellationFeeCents } from "./cancellation-fee";

describe("computeCancellationFeeCents", () => {
  it("returns 0 when fee type is none", () => {
    expect(computeCancellationFeeCents("none", 5000, 10000)).toBe(0);
  });

  it("returns the flat amount regardless of lesson price", () => {
    expect(computeCancellationFeeCents("flat", 2500, 10000)).toBe(2500);
    expect(computeCancellationFeeCents("flat", 2500, 999999)).toBe(2500);
  });

  it("computes a percentage of the lesson price", () => {
    expect(computeCancellationFeeCents("percentage", 50, 10000)).toBe(5000);
    expect(computeCancellationFeeCents("percentage", 100, 6500)).toBe(6500);
    expect(computeCancellationFeeCents("percentage", 25, 6500)).toBe(1625);
  });

  it("rounds a fractional percentage result to the nearest cent", () => {
    expect(computeCancellationFeeCents("percentage", 33, 10000)).toBe(3300);
    expect(computeCancellationFeeCents("percentage", 10, 6501)).toBe(650);
  });

  it("never returns a negative fee even with a negative value", () => {
    expect(computeCancellationFeeCents("flat", -500, 10000)).toBe(0);
    expect(computeCancellationFeeCents("percentage", -10, 10000)).toBe(0);
  });

  it("treats an unrecognized type as no fee", () => {
    expect(computeCancellationFeeCents("bogus", 5000, 10000)).toBe(0);
  });
});
