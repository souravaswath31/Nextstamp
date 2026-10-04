import type { RoadEat, RoadEatStop } from "@prisma/client";

// Turning "this itinerary's days" + "the eats we researched" into something a
// road-tripper can read. Kept pure and separate from the components so the
// grouping rules — which are the actual logic here — can be tested directly.

export type EatStopWithEats = RoadEatStop & { eats: RoadEat[] };

export type EatGroup = {
  town: string;
  /** Every day of the route that eats in this town, ascending. */
  dayNumbers: number[];
  stop: EatStopWithEats;
};

/**
 * Group a route's days by the town they eat in.
 *
 * Several days commonly share a town (three nights in Springdale for Zion), and
 * listing the same three diners under Day 1, Day 2 and Day 3 would triple the
 * length of the section and read as padding. So days are folded into one group
 * per town, ordered by the first day that reaches it, with all its days named.
 *
 * Days with no eat town (null — "Depart", or a day with no realistic answer),
 * and towns we have no researched stop for, simply produce no group. Silence is
 * the honest result there: an empty "Day 5" heading would imply we looked and
 * found nothing, when in fact we didn't or it doesn't apply.
 */
export function groupEatsByTown(
  days: { dayNumber: number; eatTown: string | null }[],
  stops: EatStopWithEats[]
): EatGroup[] {
  const byTown = new Map(stops.map((s) => [s.town, s]));
  const groups = new Map<string, EatGroup>();

  const ordered = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  for (const day of ordered) {
    if (!day.eatTown) continue;
    const stop = byTown.get(day.eatTown);
    if (!stop || stop.eats.length === 0) continue;

    const existing = groups.get(day.eatTown);
    if (existing) {
      existing.dayNumbers.push(day.dayNumber);
    } else {
      groups.set(day.eatTown, { town: day.eatTown, dayNumbers: [day.dayNumber], stop });
    }
  }
  return Array.from(groups.values());
}

/** "Day 3", "Days 1–3", "Days 1, 2 and 5" — runs collapse, gaps are listed. */
export function formatDayRange(dayNumbers: number[]): string {
  const days = [...new Set(dayNumbers)].sort((a, b) => a - b);
  if (days.length === 0) return "";
  if (days.length === 1) return `Day ${days[0]}`;

  const runs: [number, number][] = [];
  let start = days[0];
  let prev = days[0];
  for (let i = 1; i < days.length; i++) {
    if (days[i] === prev + 1) {
      prev = days[i];
    } else {
      runs.push([start, prev]);
      start = prev = days[i];
    }
  }
  runs.push([start, prev]);

  // A run of two is "1, 2" rather than "1–2"; a dash implies a longer span.
  const parts = runs.flatMap(([a, b]) => (b - a >= 2 ? [`${a}–${b}`] : b === a ? [`${a}`] : [`${a}`, `${b}`]));
  const joined =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Days ${joined}`;
}

export type Freshness = { level: "fresh" | "aging" | "stale"; label: string };

/**
 * How recently an eat's stop was verified, in words.
 *
 * A restaurant's verified date is a claim about one afternoon, not a guarantee —
 * so the UI shows its age, and says plainly once it's old enough that a traveller
 * should double-check. The thresholds are a judgement call, not a measured
 * closure rate: no authoritative source exists for how fast restaurants close
 * (searched while building this), so they err toward warning sooner.
 */
export function eatFreshness(verified: Date, asOf: Date = new Date()): Freshness {
  const months =
    (asOf.getUTCFullYear() - verified.getUTCFullYear()) * 12 +
    (asOf.getUTCMonth() - verified.getUTCMonth());

  if (months < 6) {
    return { level: "fresh", label: `Checked ${formatMonthYear(verified)}` };
  }
  if (months < 12) {
    return { level: "aging", label: `Checked ${formatMonthYear(verified)} — worth a quick look before you go` };
  }
  return {
    level: "stale",
    label: `Checked ${formatMonthYear(verified)} — over a year ago, confirm it's still open`,
  };
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export const KIND_LABELS: Record<string, string> = {
  diner: "Diner",
  bbq: "BBQ",
  bakery: "Bakery",
  cafe: "Café",
  brewery: "Brewery",
  market: "Market",
  regional: "Local specialty",
  dessert: "Dessert",
  drive_in: "Drive-in",
  seafood: "Seafood",
};

export const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  any: "Any time",
};

/** Which regions an itinerary's eats live under: state slugs, else its countries. */
export function regionKeysForItinerary(it: {
  relatedStateSlugs: string | null;
  countries: string;
}): string[] {
  const states = (it.relatedStateSlugs ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (states.length > 0) return states;
  return it.countries
    .split(",")
    .map((c) => c.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter(Boolean);
}

/**
 * Whether an hours note is a warning or just information.
 *
 * Red on a card has to mean "watch out", or it means nothing. A note like "open
 * daily 7:30 AM to 2 PM" is useful but good news; "closed Tuesdays" or "last day
 * of the season is 10/12/2026" is the thing that stops someone driving to a
 * locked door. Every note used to render red, which taught the reader to ignore
 * the colour. This is a keyword heuristic — wrong in one direction it's only a
 * colour choice, never a hidden fact, since the text itself is always shown.
 */
export function hoursNoteTone(note: string): "caution" | "info" {
  return /\b(closed|closes|closing|season|seasonal|last day|cash only|sold out|sellout|reservations? (are )?(required|recommended)|winter|temporarily|no reservations)\b/i.test(
    note
  )
    ? "caution"
    : "info";
}
