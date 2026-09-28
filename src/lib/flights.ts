// Flight and stay search, by deep link rather than by API.
//
// This is a deliberate choice, not a shortcut. There is no genuinely free
// production flight-search API: Amadeus's self-service test environment
// returns cached fares that won't match reality, Duffel is priced for
// actually selling seats, Kiwi closed self-serve access in 2024, Skyscanner
// is partner-application only, and the "Skyscanner" listings on RapidAPI are
// unofficial scrapers. Showing a traveller a fare we can't stand behind would
// be worse than showing none — see CLAUDE.md, "never fabricate a fact".
//
// So: hand the trip's dates and route to a search engine that does have real
// inventory, prefilled, and get out of the way. Free, no credentials, and
// honest about what it is.

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type FlightSearchLink = {
  provider: string;
  url: string;
  note: string;
};

/**
 * Google Flights accepts a natural-language query, which sidesteps needing
 * IATA airport codes for a free-text "home base" and a country name. It
 * resolves "Tokyo" or "Japan" to the right airports itself.
 */
export function flightSearchLinks(
  origin: string | null | undefined,
  destination: string | null | undefined,
  start: Date | null,
  end: Date | null
): FlightSearchLink[] {
  if (!destination) return [];

  const from = origin?.trim();
  const dateFragment =
    start && end
      ? ` on ${isoDate(start)} through ${isoDate(end)}`
      : start
        ? ` on ${isoDate(start)}`
        : "";
  const query = `Flights to ${destination}${from ? ` from ${from}` : ""}${dateFragment}`;

  const links: FlightSearchLink[] = [
    {
      provider: "Google Flights",
      url: `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`,
      note: from
        ? `Prefilled from ${from}${start ? ", with your dates" : ""}.`
        : "Add a home base on your profile and we'll prefill the origin too.",
    },
  ];

  if (start) {
    // Kayak's path format takes dates directly; it needs a place slug rather
    // than a free-text query, so the destination country alone is what we can
    // honestly build from.
    const slug = destination.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    links.push({
      provider: "Kayak",
      url: `https://www.kayak.com/flights/${from ? `${from.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-` : ""}${slug}/${isoDate(start)}${end ? `/${isoDate(end)}` : ""}`,
      note: "A second opinion on the same dates — fares differ between engines more than you'd expect.",
    });
  }

  return links;
}

export function staySearchLink(
  destination: string | null | undefined,
  start: Date | null,
  end: Date | null
): FlightSearchLink | null {
  if (!destination) return null;
  const dates = start && end ? `&checkin=${isoDate(start)}&checkout=${isoDate(end)}` : "";
  return {
    provider: "Google Hotels",
    url: `https://www.google.com/travel/search?q=${encodeURIComponent(`Hotels in ${destination}`)}${dates}`,
    note: start && end ? "Prefilled with your dates." : "Add dates to this trip to prefill the search.",
  };
}
