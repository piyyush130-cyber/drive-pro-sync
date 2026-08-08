import { describe, it, expect } from "vitest";
import { emailOk, formatPhone, normalizePhoneDigits, validateBookingForm } from "./booking-validation";

describe("emailOk", () => {
  it("accepts a plausible email", () => {
    expect(emailOk("sarah@example.com")).toBe(true);
  });

  it("rejects a string with no @ ", () => {
    expect(emailOk("sarahexample.com")).toBe(false);
  });

  it("rejects a string with no domain", () => {
    expect(emailOk("sarah@")).toBe(false);
  });
});

describe("formatPhone", () => {
  it("formats a full 10-digit number", () => {
    expect(formatPhone("2045551234")).toBe("(204) 555-1234");
  });

  it("strips non-digit characters before formatting", () => {
    expect(formatPhone("(204) 555-1234")).toBe("(204) 555-1234");
  });

  it("formats a partial number as the user is still typing", () => {
    expect(formatPhone("204")).toBe("(204");
    expect(formatPhone("2045")).toBe("(204) 5");
  });

  it("returns an empty string for empty input", () => {
    expect(formatPhone("")).toBe("");
  });

  it("truncates beyond 10 digits", () => {
    expect(formatPhone("20455512349999")).toBe("(204) 555-1234");
  });
});

describe("validateBookingForm", () => {
  const valid = {
    hasSelectedService: true,
    hasSelectedDate: true,
    hasSelectedTime: true,
    full_name: "Sarah Jenkins",
    phone: "2045551234",
    email: "sarah@example.com",
    pickup_address: "123 Main St",
    postal_code: "R2C 1A1",
    pickupAvailable: true,
    serviceAreas: [] as string[],
  };

  it("returns no errors for a fully valid submission", () => {
    expect(validateBookingForm(valid)).toEqual({});
  });

  it("requires a selected service, date, and time", () => {
    const errors = validateBookingForm({
      ...valid,
      hasSelectedService: false,
      hasSelectedDate: false,
      hasSelectedTime: false,
    });
    expect(errors.service).toBeDefined();
    expect(errors.date).toBeDefined();
    expect(errors.time).toBeDefined();
  });

  it("rejects a phone number that isn't 10 digits", () => {
    const errors = validateBookingForm({ ...valid, phone: "12345" });
    expect(errors.phone).toBe("Enter a 10-digit phone number.");
  });

  it("rejects an invalid email", () => {
    const errors = validateBookingForm({ ...valid, email: "not-an-email" });
    expect(errors.email).toBe("Enter a valid email.");
  });

  it("requires a pickup address", () => {
    const errors = validateBookingForm({ ...valid, pickup_address: "   " });
    expect(errors.pickup_address).toBeDefined();
  });

  it("requires a postal code", () => {
    const errors = validateBookingForm({ ...valid, postal_code: "   " });
    expect(errors.postal_code).toBe("Postal code is required.");
  });

  it("rejects a malformed postal code", () => {
    const errors = validateBookingForm({ ...valid, postal_code: "12345" });
    expect(errors.postal_code).toBe("Enter a valid postal code.");
  });

  it("rejects a postal code outside the school's configured service area", () => {
    const errors = validateBookingForm({
      ...valid,
      postal_code: "R3T 5V6",
      serviceAreas: ["R2C", "R2G"],
    });
    expect(errors.postal_code).toBe("Sorry, this address is outside our pickup area.");
  });

  it("allows a postal code inside the school's configured service area", () => {
    const errors = validateBookingForm({
      ...valid,
      postal_code: "R2C 1A1",
      serviceAreas: ["R2C", "R2G"],
    });
    expect(errors.postal_code).toBeUndefined();
  });

  it("skips pickup/postal validation entirely when pickup isn't available for the lesson type", () => {
    const errors = validateBookingForm({
      ...valid,
      pickupAvailable: false,
      pickup_address: "",
      postal_code: "",
    });
    expect(errors.pickup_address).toBeUndefined();
    expect(errors.postal_code).toBeUndefined();
  });
});

describe("normalizePhoneDigits", () => {
  it("matches the same number regardless of formatting", () => {
    expect(normalizePhoneDigits("(204) 555-0101")).toBe(normalizePhoneDigits("2045550101"));
    expect(normalizePhoneDigits("204-555-0101")).toBe(normalizePhoneDigits("204.555.0101"));
  });

  it("ignores a leading country code, comparing only the last 10 digits", () => {
    expect(normalizePhoneDigits("+1 204 555 0101")).toBe(normalizePhoneDigits("2045550101"));
  });

  it("produces different values for different numbers", () => {
    expect(normalizePhoneDigits("2045550101")).not.toBe(normalizePhoneDigits("2045550102"));
  });
});
