import { describe, it, expect } from "vitest";
import {
  extractFsa,
  isValidPostalCode,
  isPickupAreaServiced,
  normalizeServiceAreaInput,
} from "./postal-code";

describe("extractFsa", () => {
  it("extracts the FSA from a well-formed postal code", () => {
    expect(extractFsa("R2C 1A1")).toBe("R2C");
  });

  it("handles no space and lowercase", () => {
    expect(extractFsa("r2c1a1")).toBe("R2C");
  });

  it("returns null for something with no FSA pattern", () => {
    expect(extractFsa("12345")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(extractFsa("")).toBeNull();
  });
});

describe("isValidPostalCode", () => {
  it("accepts a well-formed Canadian postal code", () => {
    expect(isValidPostalCode("R2C 1A1")).toBe(true);
    expect(isValidPostalCode("r2c1a1")).toBe(true);
  });

  it("rejects a US zip code", () => {
    expect(isValidPostalCode("90210")).toBe(false);
  });

  it("rejects a partial postal code", () => {
    expect(isValidPostalCode("R2C")).toBe(false);
  });
});

describe("isPickupAreaServiced", () => {
  it("allows anything when the school has no configured service areas", () => {
    expect(isPickupAreaServiced("R2C 1A1", [])).toBe(true);
    expect(isPickupAreaServiced("not a postal code", [])).toBe(true);
  });

  it("allows a postal code whose FSA is in the list", () => {
    expect(isPickupAreaServiced("R2C 1A1", ["R2C", "R2G"])).toBe(true);
  });

  it("blocks a postal code whose FSA is not in the list", () => {
    expect(isPickupAreaServiced("R3T 5V6", ["R2C", "R2G"])).toBe(false);
  });

  it("is case-insensitive and space-insensitive on both sides", () => {
    expect(isPickupAreaServiced("r2c1a1", ["  r2c  "])).toBe(true);
  });

  it("blocks an unparseable postal code once a list is configured", () => {
    expect(isPickupAreaServiced("not a postal code", ["R2C"])).toBe(false);
  });
});

describe("normalizeServiceAreaInput", () => {
  it("parses a comma-separated list into uppercase FSAs", () => {
    expect(normalizeServiceAreaInput("r2c, r2g, r2j")).toEqual(["R2C", "R2G", "R2J"]);
  });

  it("dedupes repeated entries", () => {
    expect(normalizeServiceAreaInput("R2C, r2c, R2C")).toEqual(["R2C"]);
  });

  it("drops entries that aren't a valid FSA shape", () => {
    expect(normalizeServiceAreaInput("R2C, not-an-fsa, R2G, 123")).toEqual(["R2C", "R2G"]);
  });

  it("returns an empty array for blank input", () => {
    expect(normalizeServiceAreaInput("")).toEqual([]);
  });
});
