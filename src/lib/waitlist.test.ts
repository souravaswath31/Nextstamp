import { describe, it, expect } from "vitest";
import { validateWaitlist, makeRateLimiter } from "./waitlist";

describe("validateWaitlist", () => {
  it("accepts a normal signup and lowercases the email", () => {
    expect(validateWaitlist({ email: " Sam@Example.COM ", interest: "flights" })).toEqual({
      ok: true,
      email: "sam@example.com",
      interest: "flights",
      requestedPassport: null,
    });
  });
  it("keeps a requested passport, trimmed", () => {
    const r = validateWaitlist({ email: "a@b.co", interest: "passport", requestedPassport: "  South   Africa " });
    expect(r.ok && r.requestedPassport).toBe("South Africa");
  });
  it("rejects bad emails and unknown interests", () => {
    expect(validateWaitlist({ email: "nope", interest: "flights" }).ok).toBe(false);
    expect(validateWaitlist({ email: "a@b", interest: "flights" }).ok).toBe(false);
    expect(validateWaitlist({ email: "a@b.co", interest: "crypto" }).ok).toBe(false);
  });
  it("treats a filled honeypot as a silent bot, not an error to show", () => {
    const r = validateWaitlist({ email: "a@b.co", interest: "flights", website: "http://spam" });
    expect(r).toEqual({ ok: false, error: "", silent: true });
  });
});

describe("makeRateLimiter", () => {
  it("allows up to max in a window, then blocks, then resets", () => {
    const allow = makeRateLimiter(3, 1000);
    expect([1, 2, 3, 4].map(() => allow("ip", 0))).toEqual([true, true, true, false]);
    expect(allow("other", 0)).toBe(true);
    expect(allow("ip", 1001)).toBe(true);
  });
});
