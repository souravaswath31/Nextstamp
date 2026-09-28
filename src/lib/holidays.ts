// Public holidays during a trip's dates.
//
// Source: Nager.Date (https://date.nager.at) — no key, no signup, 100+
// countries. Cached through Next's fetch cache for a day: a country's
// holiday calendar for a given year does not change hour to hour, and this
// keeps us well clear of hammering a free service.
//
// Every call degrades to an empty list rather than throwing. A holiday
// lookup failing should never take down a trip page.

export type PublicHoliday = {
  date: string; // ISO yyyy-mm-dd
  localName: string;
  name: string;
  global: boolean;
  counties: string[] | null;
};

const NAGER_BASE = "https://date.nager.at/api/v3";
const ONE_DAY = 86_400;

async function fetchHolidaysForYear(iso2: string, year: number): Promise<PublicHoliday[]> {
  try {
    const res = await fetch(`${NAGER_BASE}/PublicHolidays/${year}/${iso2}`, {
      next: { revalidate: ONE_DAY },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .filter((h): h is PublicHoliday => Boolean(h && typeof h.date === "string"))
      .map((h) => ({
        date: h.date,
        localName: h.localName ?? h.name,
        name: h.name ?? h.localName,
        global: h.global ?? true,
        counties: Array.isArray(h.counties) ? h.counties : null,
      }));
  } catch {
    return [];
  }
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Holidays falling inside [start, end] inclusive. Spans years correctly —
 * a trip over New Year needs both calendars.
 */
export async function getHolidaysDuring(
  iso2: string | null | undefined,
  start: Date | null,
  end: Date | null
): Promise<PublicHoliday[]> {
  if (!iso2 || !start) return [];
  const last = end && end >= start ? end : start;

  const years = new Set<number>([start.getUTCFullYear(), last.getUTCFullYear()]);
  const batches = await Promise.all(
    Array.from(years).map((y) => fetchHolidaysForYear(iso2, y))
  );

  const startIso = toIsoDate(start);
  const endIso = toIsoDate(last);

  const seen = new Set<string>();
  return batches
    .flat()
    .filter((h) => h.date >= startIso && h.date <= endIso)
    .filter((h) => {
      // Nager returns one row per sub-region for regional holidays; collapse
      // them so the UI doesn't list the same day eleven times.
      const key = `${h.date}|${h.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The next handful of holidays from today onward — for a destination page
 * where there's no trip, and therefore no date range, to work with.
 */
export async function getUpcomingHolidays(
  iso2: string | null | undefined,
  limit = 5,
  asOf: Date = new Date()
): Promise<PublicHoliday[]> {
  if (!iso2) return [];
  const thisYear = asOf.getUTCFullYear();
  const [current, next] = await Promise.all([
    fetchHolidaysForYear(iso2, thisYear),
    fetchHolidaysForYear(iso2, thisYear + 1),
  ]);
  const todayIso = toIsoDate(asOf);
  const seen = new Set<string>();
  return [...current, ...next]
    .filter((h) => h.date >= todayIso)
    .filter((h) => {
      const key = `${h.date}|${h.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

export function formatHolidayDate(iso: string): string {
  // Parsed as UTC deliberately — a yyyy-mm-dd string parsed as local time
  // shows the previous day for anyone west of UTC.
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
