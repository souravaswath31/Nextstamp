import { prisma } from "./prisma";
import type { CountryClimate, CountryFact, CountryPhrase } from "@prisma/client";

// Read side of the CountryFact data set (seeded from
// data/country-facts-seed.json — see prisma/seed.ts). The stored shape uses
// the same comma/pipe-separated-string convention as the rest of this schema
// (Itinerary.countries, .category); everything user-facing goes through the
// parsers here rather than splitting strings inline in a component.

export type TransitPass = {
  name: string;
  covers: string | null;
  worth_it: string | null;
  buy_before_arrival: boolean | null;
};

export type CountryFactFull = CountryFact & {
  climate: CountryClimate[];
  phrases: CountryPhrase[];
};

export async function getCountryFact(country: string): Promise<CountryFactFull | null> {
  if (!country) return null;
  return prisma.countryFact.findUnique({
    where: { country },
    include: {
      climate: { orderBy: { monthNumber: "asc" } },
      phrases: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function getCountryFactsForCountries(countries: string[]): Promise<CountryFactFull[]> {
  if (countries.length === 0) return [];
  return prisma.countryFact.findMany({
    where: { country: { in: countries } },
    include: {
      climate: { orderBy: { monthNumber: "asc" } },
      phrases: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { country: "asc" },
  });
}

export async function listCountriesWithFacts(): Promise<string[]> {
  const rows = await prisma.countryFact.findMany({
    select: { country: true },
    orderBy: { country: "asc" },
  });
  return rows.map((r) => r.country);
}

export function splitList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function splitSources(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

// transitPassesJson is stored as a JSON string rather than a relation because
// it's always read whole, alongside the parent row, and never queried into.
// A malformed value degrades to "no passes listed" rather than throwing on a
// page render.
export function parseTransitPasses(json: string | null | undefined): TransitPass[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => p && typeof p.name === "string");
  } catch {
    return [];
  }
}

export const CLIMATE_RATING_LABELS: Record<string, string> = {
  peak: "Peak season",
  shoulder: "Shoulder season",
  low: "Low season",
  avoid: "Worth avoiding",
};

export const CLIMATE_RATING_CLASSES: Record<string, string> = {
  peak: "bg-forest/12 text-forest",
  shoulder: "bg-teal/12 text-teal",
  low: "bg-stamp/12 text-stamp",
  avoid: "bg-stampRed/12 text-stampRed",
};

/**
 * The climate rows covering a date range — usually one month, two when a
 * trip straddles a month boundary. Returns them in calendar order of the
 * trip, not of the year, so a late-December-to-January trip reads
 * December then January.
 */
export function climateForDateRange(
  climate: CountryClimate[],
  start: Date | null,
  end: Date | null
): CountryClimate[] {
  if (!start) return [];
  const last = end && end >= start ? end : start;
  const months = new Set<number>();
  const cursor = new Date(start.getTime());
  // Walk month by month rather than day by day; a trip long enough to span
  // more than a handful of months is still only a handful of iterations.
  while (cursor <= last && months.size < 12) {
    months.add(cursor.getUTCMonth() + 1);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
  }
  months.add(last.getUTCMonth() + 1);

  const ordered: CountryClimate[] = [];
  const startMonth = start.getUTCMonth() + 1;
  const sorted = Array.from(months).sort((a, b) => {
    const rank = (m: number) => (m - startMonth + 12) % 12;
    return rank(a) - rank(b);
  });
  for (const m of sorted) {
    const row = climate.find((c) => c.monthNumber === m);
    if (row) ordered.push(row);
  }
  return ordered;
}
