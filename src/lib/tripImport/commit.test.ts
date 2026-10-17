import { describe, expect, it } from "vitest";
import { buildTripRecords, sanitizeStops, SOURCE_KIND_POST, SOURCE_KIND_SUGGESTED } from "./commit";
import type { DraftStop } from "./plan";

const s = (id: string, name: string, over: Partial<DraftStop> = {}): DraftStop => ({
  id, name, origin: "post", quote: `the ${name}`, area: null, lat: 38, lng: -109, locatedBy: "guide", guideSlug: "utah", note: null, ...over,
});

describe("sanitizeStops", () => {
  it("keeps good stops and drops duplicates, junk and out-of-range coordinates", () => {
    const out = sanitizeStops([
      s("p0", "Delicate Arch"),
      s("p1", "delicate arch"), // duplicate name
      s("p0", "Other"), // duplicate id
      { id: "p2", name: "Nowhere", lat: 999, lng: 0, origin: "post" },
      null,
      "x",
      { id: "p3", name: "" },
    ]);
    expect(out.map((x) => x.name)).toEqual(["Delicate Arch", "Nowhere"]);
    expect(out[1]).toMatchObject({ lat: null, lng: null, locatedBy: null });
  });
  it("cannot be talked into a post label or quote for a suggestion, or a bad slug", () => {
    const [x] = sanitizeStops([{ ...s("s0", "Arches", { origin: "suggested", quote: "forged", note: "Suggested by NextStamp" }), guideSlug: "../etc" }]);
    expect(x.origin).toBe("suggested");
    expect(x.quote).toBeNull();
    expect(x.guideSlug).toBeNull();
  });
  it("caps the list and rejects non-arrays", () => {
    expect(sanitizeStops(Array.from({ length: 60 }, (_, i) => s(`p${i}`, `Place ${i}`)))).toHaveLength(25);
    expect(sanitizeStops("nope")).toEqual([]);
  });
});

describe("buildTripRecords", () => {
  const stops = [s("p0", "A"), s("p1", "B"), s("p2", "C", { lat: null, lng: null, locatedBy: null }), s("s0", "D", { origin: "suggested", quote: null, note: "Suggested by NextStamp, from our Utah guide." })];

  it("builds days with drive times and marks placed stops as used on their day", () => {
    const r = buildTripRecords(stops, [{ stopIds: ["p0", "p1"], drive: "2.5 hrs" }]);
    expect(r.days).toHaveLength(1);
    expect(r.days[0]).toMatchObject({ dayNumber: 1, activities: ["A", "B"], driveTime: "2.5 hrs", latitude: 38 });
    const by = Object.fromEntries(r.places.map((p) => [p.name, p]));
    expect(by.A.usedOnDay).toBe(1);
    expect(by.C.usedOnDay).toBeNull(); // unplaced: saved, not scheduled
    expect(by.D.usedOnDay).toBeNull(); // suggestion: saved, not scheduled
  });
  it("labels provenance through sourceKind and keeps the quote off the day text", () => {
    const r = buildTripRecords(stops, [{ stopIds: ["p0"], drive: null }]);
    const by = Object.fromEntries(r.places.map((p) => [p.name, p]));
    expect(by.A).toMatchObject({ sourceKind: SOURCE_KIND_POST, quote: "the A", note: null });
    expect(by.D).toMatchObject({ sourceKind: SOURCE_KIND_SUGGESTED, quote: null });
    expect(r.days[0].activities).toEqual(["A"]);
  });
  it("without an order, makes one empty day and saves everything unscheduled", () => {
    const r = buildTripRecords(stops, null);
    expect(r.days).toEqual([{ dayNumber: 1, title: "Day 1", activities: [] }]);
    expect(r.places.every((p) => p.usedOnDay === null)).toBe(true);
  });
  it("ignores order entries for stops the user unticked", () => {
    const r = buildTripRecords([s("p1", "B")], [{ stopIds: ["p0", "p1"], drive: null }]);
    expect(r.days[0].activities).toEqual(["B"]);
  });
});
