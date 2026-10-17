// What the model hands back is untrusted input. Everything here turns it into
// something we are willing to store and show, and throws away what we are not.
//
// The central rule from the brief: only places the source actually contains.
// For text sources we can check that mechanically: every place must come with
// a short quote, and the quote has to be found in the source text. A place the
// model "knows about" but the post never said is dropped.

export const MAX_PLACES = 15;

export type ExtractedPlace = {
  name: string;
  /** Broader area the post gives, e.g. "Moab, Utah". Used only to disambiguate a lookup. */
  area: string | null;
  /** The words from the source that mention it. */
  quote: string | null;
};

export type Extraction = {
  destinationCountry: string | null;
  tripTitle: string | null;
  places: ExtractedPlace[];
  dropped: { name: string; reason: string }[];
};

export function cleanLabel(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Lower-case, strip accents and punctuation, collapse space: for substring checks and name matching. */
export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function quoteIsInSource(quote: string, source: string): boolean {
  const q = normalize(quote);
  return q.length >= 3 && normalize(source).includes(q);
}

/**
 * @param sourceText the text the model was given, or null when it only saw
 *   images (then quotes cannot be checked mechanically and are shown as read
 *   from a screenshot).
 */
export function validateExtraction(raw: unknown, sourceText: string | null): Extraction {
  const out: Extraction = { destinationCountry: null, tripTitle: null, places: [], dropped: [] };
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;

  out.destinationCountry = cleanLabel(obj.destination_country, 60) || null;
  out.tripTitle = cleanLabel(obj.trip_title, 80) || null;

  const list = Array.isArray(obj.places) ? obj.places : [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const name = cleanLabel(p.name, 80);
    if (name.length < 2) continue;
    const key = normalize(name);
    if (!key || seen.has(key)) continue;

    const quote = cleanLabel(p.quote, 240) || null;
    if (sourceText !== null) {
      if (!quote) {
        out.dropped.push({ name, reason: "no quote from the post" });
        continue;
      }
      // A place must be findable in the source by its quote, and the name itself
      // (or its quote) must appear, so a made-up quote can't launder a made-up place.
      if (!quoteIsInSource(quote, sourceText)) {
        out.dropped.push({ name, reason: "quote not found in the post" });
        continue;
      }
      if (!normalize(sourceText).includes(key) && !normalize(quote).includes(key)) {
        out.dropped.push({ name, reason: "name not found in the post" });
        continue;
      }
    }
    seen.add(key);
    out.places.push({ name, area: cleanLabel(p.area, 80) || null, quote });
    if (out.places.length >= MAX_PLACES) break;
  }
  return out;
}
