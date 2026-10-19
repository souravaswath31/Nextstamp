import { describe, expect, it } from "vitest";
import { safeNext } from "./safeNext";

describe("safeNext", () => {
  it("keeps ordinary same-site paths", () => {
    expect(safeNext("/trip/abc?x=1#top")).toBe("/trip/abc?x=1#top");
    expect(safeNext("/")).toBe("/");
  });
  it("falls back to / when missing", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext("")).toBe("/");
  });
  it.each(["@evil.com", "https://evil.com", "//evil.com", "/\\evil.com", "/@evil.com", "/evil.com:80/x", "javascript:alert(1)", "/a\nb"])(
    "rejects %s",
    (bad) => expect(safeNext(bad)).toBe("/")
  );
});
