// Flight, stay and activity search, by deep link rather than by API.
//
// This is a deliberate choice, not a shortcut. There is no genuinely free
// production flight-search API: Amadeus's self-service test environment
// returns cached fares that won't match reality, Duffel is priced for
// actually selling seats, Kiwi closed self-serve access in 2024, Skyscanner
// is partner-application only, and the "Skyscanner" listings on RapidAPI are
// unofficial scrapers. Showing a traveller a fare we can't stand behind would
// be worse than showing none (see CLAUDE.md, "never fabricate a fact").
//
// So: hand the trip's dates and route to a search engine that does have real
// inventory, prefilled, and get out of the way. NextStamp never takes payment,
// holds money or issues a ticket; these are links to outside suppliers. When an
// affiliate tag is configured for a supplier (see affiliate.ts) the link carries
// it, is marked `affiliate`, and the UI discloses the commission.

import { affiliateTagFor, applyTag, type SupplierId } from "./affiliate";

export type Category = "flights" | "stays" | "activities";

export type SupplierLink = {
  id: SupplierId;
  provider: string;
  category: Category;
  url: string;
  /** True only when an affiliate tag was actually appended. */
  affiliate: boolean;
  note: string;
};

export type TripQuery = {
  origin?: string | null;
  destination?: string | null;
  start?: Date | null;
  end?: Date | null;
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const clean = (s: string | null | undefined, max = 80) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function make(
  id: SupplierId,
  provider: string,
  category: Category,
  baseUrl: string,
  note: string,
  env?: Record<string, string | undefined>
): SupplierLink {
  const { url, affiliate } = applyTag(baseUrl, affiliateTagFor(id, env));
  return { id, provider, category, url, affiliate, note };
}

/** A return date before the leave date is dropped rather than passed on to the supplier. */
export function orderedDates(q: TripQuery): { start: Date | null; end: Date | null } {
  const start = q.start ?? null;
  const end = q.end ?? null;
  if (start && end && end.getTime() < start.getTime()) return { start, end: null };
  return { start, end };
}

export function flightLinks(q: TripQuery, env?: Record<string, string | undefined>): SupplierLink[] {
  const to = clean(q.destination);
  if (!to) return [];
  const from = clean(q.origin);
  const { start, end } = orderedDates(q);

  // Google Flights accepts a natural-language query, which sidesteps needing
  // IATA airport codes for a free-text "home base" and a country name.
  const dateFragment =
    start && end ? ` on ${isoDate(start)} through ${isoDate(end)}` : start ? ` on ${isoDate(start)}` : "";
  const query = `Flights to ${to}${from ? ` from ${from}` : ""}${dateFragment}`;

  const links: SupplierLink[] = [
    make(
      "google-flights",
      "Google Flights",
      "flights",
      `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`,
      from ? `Prefilled from ${from}${start ? ", with your dates" : ""}.` : "Add a home base on your profile and we'll prefill the origin too.",
      env
    ),
  ];

  if (start) {
    // Kayak's path format takes dates directly but needs a place slug rather than free text.
    links.push(
      make(
        "kayak",
        "Kayak",
        "flights",
        `https://www.kayak.com/flights/${from ? `${slugify(from)}-` : ""}${slugify(to)}/${isoDate(start)}${end ? `/${isoDate(end)}` : ""}`,
        "A second opinion on the same dates. Fares differ between engines more than you'd expect.",
        env
      )
    );
  }
  return links;
}

export function stayLinks(q: TripQuery, env?: Record<string, string | undefined>): SupplierLink[] {
  const to = clean(q.destination);
  if (!to) return [];
  const { start, end } = orderedDates(q);
  const dated = start && end;
  const links: SupplierLink[] = [
    make(
      "google-hotels",
      "Google Hotels",
      "stays",
      `https://www.google.com/travel/search?q=${encodeURIComponent(`Hotels in ${to}`)}${dated ? `&checkin=${isoDate(start)}&checkout=${isoDate(end)}` : ""}`,
      dated ? "Prefilled with your dates." : "Add dates to prefill the search.",
      env
    ),
    make(
      "booking",
      "Booking.com",
      "stays",
      `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(to)}${dated ? `&checkin=${isoDate(start)}&checkout=${isoDate(end)}` : ""}`,
      dated ? "Same place and dates, on a second site." : "Add dates to prefill the search.",
      env
    ),
  ];
  return links;
}

export type ActivityGroup = { label: string; links: SupplierLink[] };

/** Tours and tickets: one group for the destination, then one per named place (max 4). */
export function activityLinks(
  q: TripQuery,
  places: string[] = [],
  env?: Record<string, string | undefined>
): ActivityGroup[] {
  const to = clean(q.destination);
  const forTerm = (term: string): SupplierLink[] => [
    make("getyourguide", "GetYourGuide", "activities", `https://www.getyourguide.com/s/?q=${encodeURIComponent(term)}`, `Tours and tickets for ${term}.`, env),
    make("viator", "Viator", "activities", `https://www.viator.com/searchResults/all?text=${encodeURIComponent(term)}`, `Tours and tickets for ${term}.`, env),
  ];
  const groups: ActivityGroup[] = [];
  if (to) groups.push({ label: to, links: forTerm(to) });
  const seen = new Set(to ? [to.toLowerCase()] : []);
  for (const p of places) {
    const name = clean(p);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    groups.push({ label: to ? `${name}, ${to}`.slice(0, 100) : name, links: forTerm(to ? `${name} ${to}` : name) });
    if (groups.length >= 5) break;
  }
  return groups;
}

export const AFFILIATE_DISCLOSURE =
  "Some of these links are affiliate links: if you book through them, NextStamp may earn a commission from the supplier. It doesn't add to the price you pay, and it doesn't change which links we show or in what order.";

export const NO_AFFILIATE_NOTE = "None of these links earn NextStamp anything.";

export function anyAffiliate(links: SupplierLink[]): boolean {
  return links.some((l) => l.affiliate);
}

/** Parses a yyyy-mm-dd search param; anything else is null. */
export function parseDateParam(v: string | string[] | undefined): Date | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || isoDate(d) !== s ? null : d;
}
