import { describe, it, expect } from "vitest";
import { friendlyAuthError } from "./authErrors";

// These strings are what a person sees when sign-in fails, which is the worst
// possible moment to show them developer shorthand. Worth pinning.

describe("friendlyAuthError", () => {
  it("explains the rate limit instead of blaming the user or inviting a retry", () => {
    const out = friendlyAuthError("email rate limit exceeded");
    expect(out).toContain("limit on our end");
    expect(out).toContain("try again in an hour");
    // The raw Supabase wording must not leak through.
    expect(out.toLowerCase()).not.toContain("rate limit exceeded");
  });

  it("catches the other phrasings of the same condition", () => {
    for (const raw of ["Too many requests", "Email rate limit exceeded", "over_email_send_rate_limit"]) {
      expect(friendlyAuthError(raw)).toContain("hourly limit");
    }
  });

  it("handles a malformed address", () => {
    expect(friendlyAuthError("Unable to validate email address: invalid format")).toContain(
      "valid email address"
    );
  });

  it("handles closed signups and network failures", () => {
    expect(friendlyAuthError("Signups not allowed for this instance")).toContain("closed");
    expect(friendlyAuthError("Failed to fetch")).toContain("connection");
  });

  it("still surfaces an unrecognised error rather than swallowing it", () => {
    // A real fault has to stay debuggable — hiding it would be worse than terse.
    const out = friendlyAuthError("some unexpected backend failure");
    expect(out).toContain("some unexpected backend failure");
    // Method-agnostic: this path is reached from both the email and Google
    // flows, so it must not claim we failed to "send a link".
    expect(out).toContain("couldn't sign you in");
    expect(out).not.toContain("link");
  });

  it("tells the user to fall back when Google isn't configured yet", () => {
    for (const raw of ["Unsupported provider: provider is not enabled", "unsupported provider"]) {
      expect(friendlyAuthError(raw)).toContain("magic link");
    }
  });

  it("treats a cancelled consent screen as a choice, not a failure", () => {
    expect(friendlyAuthError("access_denied")).toContain("cancelled");
    expect(friendlyAuthError("access_denied")).toContain("Nothing happened");
  });

  it("explains a stale magic link", () => {
    expect(friendlyAuthError("Email link is invalid or has expired")).toContain("expired");
    expect(friendlyAuthError("Email link is invalid or has expired")).toContain("fresh one");
  });
});
