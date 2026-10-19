import { describe, expect, it } from "vitest";
import { hasAuthCookie } from "./authCookie";

describe("hasAuthCookie", () => {
  it("sees a Supabase session cookie, whole or chunked", () => {
    expect(hasAuthCookie(["theme", "sb-abc-auth-token"])).toBe(true);
    expect(hasAuthCookie(["sb-abc-auth-token.0", "sb-abc-auth-token.1"])).toBe(true);
  });
  it("ignores everything else", () => {
    expect(hasAuthCookie([])).toBe(false);
    expect(hasAuthCookie(["sb-abc-code-verifier", "_vercel_jwt", "auth-token"])).toBe(false);
  });
});
