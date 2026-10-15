import { describe, it, expect } from "vitest";
import { slugify, assignUniqueSlugs } from "./slug";

describe("slugify", () => {
  it("makes readable lowercase slugs from real itinerary titles", () => {
    expect(slugify("Napa Valley & San Francisco")).toBe("napa-valley-and-san-francisco");
    expect(slugify("California: Yosemite & the Sierra Nevada")).toBe(
      "california-yosemite-and-the-sierra-nevada"
    );
  });
  it("drops apostrophes instead of splitting words on them", () => {
    expect(slugify("Hawai'i Island")).toBe("hawaii-island");
  });
  it("strips accents and never leaves stray hyphens", () => {
    expect(slugify("  Zürich — Lucerne!! ")).toBe("zurich-lucerne");
  });
});

describe("assignUniqueSlugs", () => {
  it("suffixes a repeated title rather than reusing the URL", () => {
    expect(assignUniqueSlugs(["Tokyo", "Kyoto", "Tokyo", "Tokyo"])).toEqual([
      "tokyo",
      "kyoto",
      "tokyo-2",
      "tokyo-3",
    ]);
  });
  it("is deterministic for the same input order", () => {
    const t = ["A b", "A-b", "a  b"];
    expect(assignUniqueSlugs(t)).toEqual(assignUniqueSlugs(t));
    expect(new Set(assignUniqueSlugs(t)).size).toBe(3);
  });
});
