import { describe, it, expect } from "vitest";
import {
  eatFreshness,
  formatDayRange,
  groupEatsByTown,
  hoursNoteTone,
  regionKeysForItinerary,
  type EatStopWithEats,
} from "./roadEats";

const stop = (town: string, nEats = 2): EatStopWithEats => ({
  id: `s-${town}`,
  regionKey: "utah",
  town,
  note: null,
  noteSourceUrl: null,
  lastVerifiedDate: new Date("2026-10-03T12:00:00Z"),
  eats: Array.from({ length: nEats }, (_, i) => ({
    id: `e-${town}-${i}`,
    stopId: `s-${town}`,
    name: `${town} eat ${i}`,
    kind: "diner",
    meal: "lunch",
    whatToOrder: "x",
    why: "y",
    priceTier: null,
    hoursNote: null,
    openEvidence: "own site, 2026",
    sourceUrl: "https://example.com",
    sourceName: "site",
    sortOrder: i,
  })),
});

describe("groupEatsByTown", () => {
  it("folds days that share a town into one group instead of repeating the list", () => {
    // Zion: three nights in Springdale. Listing the same diners under Day 1,
    // Day 2 and Day 3 would triple the section and read as padding.
    const groups = groupEatsByTown(
      [
        { dayNumber: 1, eatTown: "Springdale" },
        { dayNumber: 2, eatTown: "Springdale" },
        { dayNumber: 3, eatTown: "Springdale" },
        { dayNumber: 4, eatTown: "Bryce Canyon City" },
      ],
      [stop("Springdale"), stop("Bryce Canyon City")]
    );
    expect(groups.map((g) => g.town)).toEqual(["Springdale", "Bryce Canyon City"]);
    expect(groups[0].dayNumbers).toEqual([1, 2, 3]);
    expect(groups[1].dayNumbers).toEqual([4]);
  });

  it("orders groups by the first day that reaches each town, whatever order days arrive in", () => {
    const groups = groupEatsByTown(
      [
        { dayNumber: 4, eatTown: "Moab" },
        { dayNumber: 1, eatTown: "Springdale" },
      ],
      [stop("Moab"), stop("Springdale")]
    );
    expect(groups.map((g) => g.town)).toEqual(["Springdale", "Moab"]);
  });

  it("names every day of a town that is revisited later", () => {
    const groups = groupEatsByTown(
      [
        { dayNumber: 1, eatTown: "Austin" },
        { dayNumber: 2, eatTown: "Fredericksburg" },
        { dayNumber: 6, eatTown: "Austin" },
      ],
      [stop("Austin"), stop("Fredericksburg")]
    );
    expect(groups.find((g) => g.town === "Austin")?.dayNumbers).toEqual([1, 6]);
  });

  it("produces no group for a null town — silence, not an empty heading", () => {
    // A "Depart" day has no eat town. An empty "Day 5" heading would imply we
    // looked and found nothing, which is not what happened.
    const groups = groupEatsByTown(
      [
        { dayNumber: 1, eatTown: "Moab" },
        { dayNumber: 5, eatTown: null },
      ],
      [stop("Moab")]
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].dayNumbers).toEqual([1]);
  });

  it("skips a town we have no researched stop for", () => {
    const groups = groupEatsByTown([{ dayNumber: 1, eatTown: "Nowhere" }], [stop("Moab")]);
    expect(groups).toEqual([]);
  });

  it("skips a stop that has no eats rather than rendering an empty card", () => {
    const groups = groupEatsByTown([{ dayNumber: 1, eatTown: "Moab" }], [stop("Moab", 0)]);
    expect(groups).toEqual([]);
  });
});

describe("formatDayRange", () => {
  it("handles one day, two adjacent days, and a longer run", () => {
    expect(formatDayRange([3])).toBe("Day 3");
    // A run of two is "1, 2", not "1–2": a dash implies a longer span.
    expect(formatDayRange([1, 2])).toBe("Days 1 and 2");
    expect(formatDayRange([1, 2, 3])).toBe("Days 1–3");
  });

  it("lists gaps rather than pretending the days are contiguous", () => {
    expect(formatDayRange([1, 6])).toBe("Days 1 and 6");
    expect(formatDayRange([1, 2, 3, 6])).toBe("Days 1–3 and 6");
  });

  it("is order- and duplicate-insensitive, and safe on empty", () => {
    expect(formatDayRange([3, 1, 2, 2])).toBe("Days 1–3");
    expect(formatDayRange([])).toBe("");
  });
});

describe("eatFreshness", () => {
  const asOf = new Date("2026-10-03T12:00:00Z");

  it("calls a recent check fresh and says when", () => {
    const f = eatFreshness(new Date("2026-09-20T12:00:00Z"), asOf);
    expect(f.level).toBe("fresh");
    expect(f.label).toContain("September 2026");
  });

  it("starts warning at six months", () => {
    expect(eatFreshness(new Date("2026-05-01T12:00:00Z"), asOf).level).toBe("fresh");
    expect(eatFreshness(new Date("2026-03-01T12:00:00Z"), asOf).level).toBe("aging");
  });

  it("tells the traveller to confirm once it's over a year old", () => {
    const f = eatFreshness(new Date("2025-06-01T12:00:00Z"), asOf);
    expect(f.level).toBe("stale");
    expect(f.label).toContain("confirm it's still open");
  });
});

describe("regionKeysForItinerary", () => {
  it("uses state slugs for a domestic route", () => {
    expect(
      regionKeysForItinerary({ relatedStateSlugs: "washington,colorado", countries: "USA" })
    ).toEqual(["washington", "colorado"]);
  });

  it("falls back to the countries for an international route", () => {
    expect(
      regionKeysForItinerary({ relatedStateSlugs: null, countries: "Sri Lanka,Maldives" })
    ).toEqual(["sri-lanka", "maldives"]);
  });
});

describe("hoursNoteTone", () => {
  it("flags the things that stop someone driving to a locked door", () => {
    for (const note of [
      "Closed Tuesdays",
      "Listed open Wednesday through Monday from 11 AM until sellout; closed Tuesdays",
      "Seasonal, May through October: closed Wednesdays; last day of the season is 10/12/2026; cash only",
      "Dinner only, open March 23-October 29, 2026 and closed for winter",
      "Reservations recommended October through April",
      "Directory lists closed Wednesday-Thursday; confirm before driving",
    ]) {
      expect(hoursNoteTone(note), note).toBe("caution");
    }
  });

  it("treats ordinary hours as information, not a warning", () => {
    // Real notes from the research. Red on these taught the reader to ignore red.
    for (const note of [
      "Listed open daily 7:30 AM to 2 PM, including Christmas morning; to-go orders available",
      "Open 7 days a week 5AM-9PM",
      "Sunday-Thursday 11 AM-9 PM; Friday and Saturday 11 AM-10 PM",
    ]) {
      expect(hoursNoteTone(note), note).toBe("info");
    }
  });
});
