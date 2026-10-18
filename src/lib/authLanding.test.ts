import { describe, expect, it } from "vitest";
import { authCodeLandingRedirect } from "./authLanding";

describe("authCodeLandingRedirect", () => {
  it("forwards a code that landed on the home page to the callback route", () => {
    expect(authCodeLandingRedirect("/", "?code=e764518c-f6d7-47d2-9027-c57c69045a59")).toBe(
      "/auth/callback?code=e764518c-f6d7-47d2-9027-c57c69045a59"
    );
  });
  it("keeps the other query parameters", () => {
    expect(authCodeLandingRedirect("/", "?code=e764518c-f6d7-47d2-9027-c57c69045a59&next=%2Ftrip%2F1")).toBe(
      "/auth/callback?code=e764518c-f6d7-47d2-9027-c57c69045a59&next=%2Ftrip%2F1"
    );
  });
  it("ignores other pages, a missing code and non-code values", () => {
    expect(authCodeLandingRedirect("/auth/callback", "?code=e764518c-f6d7-47d2-9027-c57c69045a59")).toBeNull();
    expect(authCodeLandingRedirect("/", "")).toBeNull();
    expect(authCodeLandingRedirect("/", "?code=abc")).toBeNull();
    expect(authCodeLandingRedirect("/", "?code=<script>alert(1)</script>")).toBeNull();
  });
});
