import { describe, it, expect } from "vitest";
import { friendlyAuthError } from "./auth-errors";

describe("friendlyAuthError", () => {
  it("gives an actionable message for an unconfirmed email", () => {
    expect(friendlyAuthError("Email not confirmed")).toMatch(/confirm your email/i);
  });

  it("gives an actionable message for bad credentials", () => {
    expect(friendlyAuthError("Invalid login credentials")).toMatch(/isn't right/i);
  });

  it("points a duplicate signup toward signing in instead", () => {
    expect(friendlyAuthError("User already registered")).toMatch(/try signing in/i);
  });

  it("explains a duplicate email on account update", () => {
    expect(friendlyAuthError("Email address already in use")).toMatch(/already in use/i);
  });

  it("explains a rate limit", () => {
    expect(friendlyAuthError("email rate limit exceeded")).toMatch(/too many times/i);
  });

  it("explains a network failure", () => {
    expect(friendlyAuthError("Failed to fetch")).toMatch(/couldn't reach the server/i);
  });

  it("falls back to the original message for anything unrecognized", () => {
    expect(friendlyAuthError("Some brand-new Supabase error")).toBe(
      "Some brand-new Supabase error",
    );
  });
});
