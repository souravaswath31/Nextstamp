import { describe, expect, it } from "vitest";
import { splitSummary } from "./shorten";

describe("splitSummary", () => {
  it("leaves short text whole", () => {
    expect(splitSummary("A short rule. Nothing more.")).toEqual({ short: "A short rule. Nothing more.", rest: "" });
  });
  it("leaves text only slightly over the limit whole", () => {
    const t = "x".repeat(300);
    expect(splitSummary(t, 240).rest).toBe("");
  });
  it("cuts a long text at a sentence end and keeps every character", () => {
    const sentence = "This is a fairly ordinary sentence about entry rules. ";
    const text = sentence.repeat(20).trim();
    const { short, rest } = splitSummary(text, 240);
    expect(short.endsWith(".")).toBe(true);
    expect(short.length).toBeLessThanOrEqual(320);
    expect(rest.length).toBeGreaterThan(0);
    expect((short + " " + rest).replace(/\s+/g, " ")).toBe(text.replace(/\s+/g, " "));
  });
  it("falls back to a word boundary when there is no sentence end", () => {
    const text = "word ".repeat(200).trim();
    const { short, rest } = splitSummary(text, 240);
    expect(short.endsWith("…")).toBe(true);
    expect(rest.length).toBeGreaterThan(0);
  });
});
