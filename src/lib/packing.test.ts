import { describe, it, expect } from "vitest";
import { generatePackingList } from "./packing";

describe("generatePackingList", () => {
  it("always includes the two universal sections", () => {
    const sections = generatePackingList([]);
    const titles = sections.map((s) => s.title);
    expect(titles).toContain("Documents & money");
    expect(titles).toContain("Health & comfort");
    expect(sections).toHaveLength(2);
  });

  it("adds a category-specific section for a recognized category", () => {
    const sections = generatePackingList(["nature"]);
    expect(sections.map((s) => s.title)).toContain("For the outdoors");
  });

  it("adds one section per distinct category, in addition to the universal two", () => {
    const sections = generatePackingList(["nature", "city", "water"]);
    expect(sections).toHaveLength(2 + 3);
  });

  it("never adds the same section twice, even if categories repeat", () => {
    const sections = generatePackingList(["nature", "nature", "nature"]);
    const outdoorSections = sections.filter((s) => s.title === "For the outdoors");
    expect(outdoorSections).toHaveLength(1);
  });

  it("silently ignores a category with no matching section rather than crashing", () => {
    const sections = generatePackingList(["not-a-real-category"]);
    expect(sections).toHaveLength(2); // just the universal ones
  });

  it("every section has at least one item", () => {
    const sections = generatePackingList(["nature", "city", "water", "splurge", "budget", "road-trip", "off-the-beaten-path"]);
    for (const section of sections) {
      expect(section.items.length).toBeGreaterThan(0);
    }
  });
});
