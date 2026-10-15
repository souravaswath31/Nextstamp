import { prisma } from "./prisma";
import type { PublicRule } from "./passportCheck";

// Everything a marketing page states as a number comes from here, from the
// database, at request time. Nothing on those pages is typed in by hand: when
// a country is added the page changes by itself, and when the data is thin the
// page says less rather than rounding up.

export async function getPublicRules(): Promise<PublicRule[]> {
  const rows = await prisma.visaRule.findMany({
    orderBy: [{ passportCountry: "asc" }, { destinationCountry: "asc" }],
  });
  return rows.map((r) => ({
    passport: r.passportCountry,
    destination: r.destinationCountry,
    visaType: r.visaType as PublicRule["visaType"],
    requiresDocCountry: r.requiresHeldDocumentCountry,
    conditions: r.conditionsText,
    maxStayDays: r.maxStayDays,
    feeNotes: r.feeNotes,
    sourceUrl: r.sourceUrl,
    verified: r.lastVerifiedDate.toISOString().slice(0, 10),
  }));
}

export type SiteStats = {
  states: number;
  places: number;
  itineraries: number;
  domesticItineraries: number;
  visaRules: number;
  passports: string[];
  destinations: string[];
  countryGuides: number;
  /** The most recent date any visa rule was checked against its source. */
  latestVerified: Date | null;
  /** The oldest — what a "sourced and dated" claim must be honest about. */
  oldestVerified: Date | null;
};

export async function getSiteStats(): Promise<SiteStats> {
  const [states, places, itineraries, domestic, rules, guides, dates] = await Promise.all([
    prisma.stateGuide.count(),
    // food_culture rows are dishes and traditions, not places you can visit.
    prisma.statePlace.count({ where: { category: { not: "food_culture" } } }),
    prisma.itinerary.count({ where: { isPublic: true } }),
    prisma.itinerary.count({ where: { isPublic: true, relatedStateSlugs: { not: null } } }),
    prisma.visaRule.findMany({
      select: { passportCountry: true, destinationCountry: true },
    }),
    prisma.countryFact.count(),
    prisma.visaRule.aggregate({ _max: { lastVerifiedDate: true }, _min: { lastVerifiedDate: true } }),
  ]);
  return {
    states,
    places,
    itineraries,
    domesticItineraries: domestic,
    visaRules: rules.length,
    passports: Array.from(new Set(rules.map((r) => r.passportCountry))).sort(),
    destinations: Array.from(new Set(rules.map((r) => r.destinationCountry))).sort(),
    countryGuides: guides,
    latestVerified: dates._max.lastVerifiedDate,
    oldestVerified: dates._min.lastVerifiedDate,
  };
}

/**
 * A spread of trips for the landing page, one per category before any repeats,
 * so the six differ from each other. "Popular" would be a claim — we have no
 * usage data — so the page calls them a place to start, and this picks by
 * variety, deterministically, not by invented popularity.
 */
export async function getFeaturedItineraries(count = 6) {
  const all = await prisma.itinerary.findMany({
    where: { isPublic: true },
    orderBy: { title: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      category: true,
      countries: true,
      region: true,
      durationDaysMin: true,
      durationDaysMax: true,
      coverImageUrl: true,
    },
  });
  const picked: typeof all = [];
  const wanted = ["nature", "city", "water", "road-trip", "off-the-beaten-path", "splurge", "budget"];
  for (const cat of wanted) {
    if (picked.length >= count) break;
    const hit = all.find((i) => i.category.split(",").includes(cat) && !picked.includes(i));
    if (hit) picked.push(hit);
  }
  for (const i of all) {
    if (picked.length >= count) break;
    if (!picked.includes(i)) picked.push(i);
  }
  return picked;
}
