import { describe, expect, it } from "vitest";
import {
  bestWindow,
  cleanName,
  DUELS,
  distanceFrom,
  groupBudget,
  haversineMiles,
  makeDeck,
  mulberry32,
  pickWinner,
  roleFor,
  shareText,
  sumVibe,
  validConfig,
  votesFor,
  type EngineDay,
  type EngineItinerary,
  type GameConfig,
} from "./engine";

const day = (title: string, lat: number | null, lon: number | null): EngineDay => ({
  title,
  activities: [`Do ${title}`],
  lat,
  lon,
  eatTown: null,
  lodging: null,
});

function trip(id: string, over: Partial<EngineItinerary> & { days?: EngineDay[] } = {}): EngineItinerary {
  return {
    id,
    slug: id,
    title: `Trip ${id}`,
    tier: "mid",
    categories: ["nature"],
    months: [9],
    states: ["illinois"],
    days: [day("a", 41.9, -87.6), day("b", 42.0, -87.7), day("c", 42.1, -87.8), day("d", 42.2, -87.9)],
    cover: null,
    ...over,
  };
}

const cfg: GameConfig = { fromState: "illinois", days: 3, month: 9, reach: "any" };

describe("geography", () => {
  it("measures a known distance", () => {
    // Chicago to New York is about 710 miles in a straight line
    expect(Math.round(haversineMiles(41.88, -87.63, 40.71, -74.0))).toBeGreaterThan(700);
    expect(Math.round(haversineMiles(41.88, -87.63, 40.71, -74.0))).toBeLessThan(725);
    expect(haversineMiles(10, 10, 10, 10)).toBe(0);
  });

  it("cuts the window whose stops sit closest together", () => {
    const days = [
      day("far", 30, -100),
      day("near1", 41, -87),
      day("near2", 41.1, -87.1),
      day("near3", 41.2, -87.2),
      day("far2", 25, -80),
    ];
    expect(bestWindow(days, 3)).toBe(1);
  });

  it("returns null when the itinerary is shorter than the window", () => {
    expect(bestWindow([day("a", 1, 1), day("b", 1, 1)], 3)).toBeNull();
  });

  it("falls back to the state centre when the cut days have no coordinates", () => {
    const it = trip("x", { days: [day("a", null, null), day("b", null, null), day("c", null, null)], states: ["texas"] });
    const d = distanceFrom("illinois", it, 0, 3);
    expect(d).not.toBeNull();
    expect(d as number).toBeGreaterThan(500);
  });
});

describe("rng", () => {
  it("is deterministic for a seed", () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("the questions", () => {
  it("turns duel answers into category votes", () => {
    const v = votesFor([0, 0, 0, 0, 0, 0]); // always the first option
    expect(v.nature).toBe(4);
    expect(v["road-trip"]).toBe(2);
    const w = votesFor([1, 1, 1, 1, 1, 1]);
    expect(w.splurge).toBeGreaterThan(w.nature ?? 0);
  });

  it("adds the group's votes", () => {
    expect(sumVibe([{ nature: 2 }, { nature: 1, city: 3 }])).toEqual({ nature: 3, city: 3 });
  });

  it("gives every friend a role", () => {
    expect(roleFor([0, 0, 0, 0, 0, 0])).toBe("The Trailblazer");
    expect(roleFor([1, 1, 1, 1, 1, 1])).toBe("The Treat-Yourself Captain");
    expect(roleFor([])).toBe("The Mystery Guest");
    expect(DUELS).toHaveLength(6);
  });
});

describe("makeDeck", () => {
  const catalog: EngineItinerary[] = [
    trip("cheap-near", { tier: "budget", categories: ["nature"] }),
    trip("mid-near", { tier: "mid", categories: ["city"] }),
    trip("rich-near", { tier: "splurge", categories: ["splurge"] }),
    trip("far-budget", { tier: "budget", categories: ["water"], days: [day("a", 34, -118), day("b", 34.1, -118.1), day("c", 34.2, -118.2)], states: ["california"] }),
    trip("short", { days: [day("a", 41, -87), day("b", 41, -87)] }),
  ];

  it("never deals an itinerary too short for the days off", () => {
    const { cards } = makeDeck({ itineraries: catalog, config: cfg, vibe: {}, budget: 2000, seed: 1 });
    expect(cards.map((c) => c.itineraryId)).not.toContain("short");
  });

  it("cuts every card to exactly the days asked for", () => {
    const { cards } = makeDeck({ itineraries: catalog, config: { ...cfg, days: 3 }, vibe: {}, budget: 2000, seed: 1 });
    for (const c of cards) expect(c.days).toHaveLength(3);
  });

  it("is reproducible from the seed and changes with it", () => {
    const a = makeDeck({ itineraries: catalog, config: cfg, vibe: {}, budget: 2000, seed: 3 }).cards.map((c) => c.itineraryId);
    const b = makeDeck({ itineraries: catalog, config: cfg, vibe: {}, budget: 2000, seed: 3 }).cards.map((c) => c.itineraryId);
    expect(a).toEqual(b);
  });

  it("respects the budget when enough trips fit", () => {
    const many = Array.from({ length: 8 }, (_, i) => trip(`b${i}`, { tier: "budget" })).concat([trip("pricey", { tier: "splurge" })]);
    const { cards, meta } = makeDeck({ itineraries: many, config: cfg, vibe: {}, budget: 400, seed: 2 });
    expect(cards.map((c) => c.itineraryId)).not.toContain("pricey");
    expect(meta.stretched).toBe(false);
    expect(meta.lockedCount).toBe(1);
    expect(meta.lockedFrom).toBe(1650);
  });

  it("stretches past the budget when too few trips fit, and says so", () => {
    const { cards, meta } = makeDeck({ itineraries: [trip("only", { tier: "splurge" })], config: cfg, vibe: {}, budget: 100, seed: 1 });
    expect(cards).toHaveLength(1);
    expect(meta.stretched).toBe(true);
    expect(cards[0].overBudget).toBe(true);
  });

  it("widens the reach when nothing is close", () => {
    const farOnly = [1, 2, 3].map((i) => trip(`la${i}`, { days: [day("a", 34, -118), day("b", 34.1, -118.1), day("c", 34.2, -118.2)], states: ["california"] }));
    const { cards, meta } = makeDeck({ itineraries: farOnly, config: { ...cfg, reach: "drive" }, vibe: {}, budget: 2000, seed: 1 });
    expect(cards.length).toBe(3);
    expect(meta.widenedTo).toBe("any");
  });

  it("keeps trips beyond the chosen reach out when enough are inside it", () => {
    const near = [1, 2, 3].map((i) => trip(`n${i}`));
    const far = trip("far", { days: [day("a", 34, -118), day("b", 34.1, -118.1), day("c", 34.2, -118.2)], states: ["california"] });
    const { cards, meta } = makeDeck({ itineraries: [...near, far], config: { ...cfg, reach: "drive" }, vibe: {}, budget: 2000, seed: 1 });
    expect(cards.map((c) => c.itineraryId)).not.toContain("far");
    expect(meta.widenedTo).toBeNull();
  });

  it("explains each card with chips", () => {
    const { cards } = makeDeck({ itineraries: catalog, config: cfg, vibe: { nature: 4 }, budget: 2000, seed: 1 });
    const text = cards[0].why.map((w) => w.text).join(" | ");
    expect(text).toMatch(/About \$\d+ each/);
  });
});

describe("pickWinner", () => {
  it("most picks wins", () => {
    const r = pickWinner([{ pick: 1, veto: null }, { pick: 1, veto: null }, { pick: 0, veto: null }], 3, 1);
    expect(r.winner).toBe(1);
    expect(r.note).toBe("Most picks wins.");
  });

  it("a vetoed card cannot win", () => {
    const r = pickWinner([{ pick: 0, veto: null }, { pick: 0, veto: null }, { pick: 1, veto: 0 }], 3, 1);
    expect(r.vetoed[0]).toBe(true);
    expect(r.winner).toBe(1);
  });

  it("breaks a tie with a coin flip that is repeatable", () => {
    const ballots = [{ pick: 0, veto: null }, { pick: 1, veto: null }];
    const a = pickWinner(ballots, 3, 9);
    const b = pickWinner(ballots, 3, 9);
    expect(a.winner).toBe(b.winner);
    expect([0, 1]).toContain(a.winner);
    expect(a.note).toMatch(/coin flip/);
  });

  it("cancels vetoes when every card is vetoed", () => {
    const r = pickWinner([{ pick: 2, veto: 0 }, { pick: 2, veto: 1 }, { pick: null, veto: 2 }], 3, 1);
    expect(r.note).toMatch(/Every card was vetoed/);
    expect(r.winner).toBe(2);
  });

  it("falls back to the draw order when nobody picked", () => {
    const r = pickWinner([{ pick: null, veto: null }], 3, 1);
    expect(r.winner).toBe(0);
    expect(r.note).toMatch(/draw order/);
  });
});

describe("group budget", () => {
  it("the lowest budget is the group budget, and that friend is the Budget Boss", () => {
    expect(groupBudget([500, 300, 800], 400)).toEqual({ budget: 300, bossIndex: 1 });
  });
  it("uses the fallback when nobody set one", () => {
    expect(groupBudget([null, null], 400)).toEqual({ budget: 400, bossIndex: null });
  });
});

describe("validation", () => {
  it("accepts a good config and rejects bad ones", () => {
    expect(validConfig(cfg)).toBe(true);
    expect(validConfig({ ...cfg, days: 9 })).toBe(false);
    expect(validConfig({ ...cfg, fromState: "narnia" })).toBe(false);
    expect(validConfig({ ...cfg, reach: "moon" as never })).toBe(false);
    expect(validConfig({ ...cfg, month: 12 })).toBe(false);
    expect(validConfig(null)).toBe(false);
  });

  it("cleans names", () => {
    expect(cleanName("  Sam  ")).toBe("Sam");
    expect(cleanName("<b>Al</b>")).toBe("bAl/b");
    expect(cleanName("x".repeat(40))).toHaveLength(14);
    expect(cleanName("   ")).toBeNull();
    expect(cleanName(42)).toBeNull();
  });
});

describe("shareText", () => {
  it("builds a chat summary with the days", () => {
    const { cards } = makeDeck({ itineraries: [trip("a"), trip("b"), trip("c")], config: cfg, vibe: {}, budget: 2000, seed: 1 });
    const t = shareText(cards[0], ["Alex", "Sam"], cfg, "Illinois");
    expect(t).toMatch(/Escape Hatch trip:/);
    expect(t).toMatch(/Crew: Alex, Sam/);
    expect(t).toMatch(/Day 1:/);
    expect(t).toMatch(/not counting getting there/);
  });
});
