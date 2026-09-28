// Official government travel advisories, surfaced next to the visa answer
// where a traveller is already making a go/no-go decision.
//
// Two sources, deliberately both rather than one:
//   • UK FCDO Content API — https://www.gov.uk/api/content/foreign-travel-advice/<slug>
//     Real JSON, no key. Licensed under the Open Government Licence v3.0,
//     which requires attribution — AdvisoryPanel renders it, don't remove it.
//   • US State Department — https://travel.state.gov/_res/rss/TAsTWs.xml
//     One RSS document containing every country's current advisory level.
//     Public domain. Matched on the feed's own Country-Tag (ISO alpha-2).
//
// Two governments disagreeing about a destination is genuinely useful signal,
// and showing only one would quietly pick a side. Both degrade to null on any
// failure; a trip page must never fail because gov.uk was slow.

export type FcdoAdvisory = {
  country: string;
  url: string;
  /** FCDO's own banner state, e.g. "advise_against_all_but_essential_travel". */
  alertStatus: string[];
  summary: string | null;
  updatedAt: string | null;
  reviewedAt: string | null;
};

export type StateDeptAdvisory = {
  country: string;
  /** 1-4. 1 = normal precautions, 4 = do not travel. */
  level: number | null;
  levelText: string;
  url: string;
  publishedAt: string | null;
};

const SIX_HOURS = 21_600;

// gov.uk slugs don't always match our country strings ("UAE" →
// "united-arab-emirates", "USA" → "usa"). Only the ones that differ from a
// naive lowercase-and-hyphenate need an entry; all verified against the live
// API rather than guessed.
const FCDO_SLUGS: Record<string, string> = {
  UAE: "united-arab-emirates",
  USA: "usa",
  UK: "uk",
  "Costa Rica": "costa-rica",
  "Sri Lanka": "sri-lanka",
};

function fcdoSlugFor(country: string): string {
  return FCDO_SLUGS[country] ?? country.toLowerCase().replace(/\s+/g, "-");
}

/** Crude but adequate: we only ever render this as text, never as HTML. */
function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|li|h2|h3|div)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export async function getFcdoAdvisory(country: string): Promise<FcdoAdvisory | null> {
  if (!country) return null;
  const slug = fcdoSlugFor(country);
  try {
    const res = await fetch(`https://www.gov.uk/api/content/foreign-travel-advice/${slug}`, {
      next: { revalidate: SIX_HOURS },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      public_updated_at?: string;
      details?: {
        alert_status?: string[];
        reviewed_at?: string;
        parts?: { slug?: string; body?: string }[];
      };
    };

    const warnings = data.details?.parts?.find((p) => p.slug === "warnings-and-insurance");
    const text = warnings?.body ? htmlToText(warnings.body) : null;

    return {
      country,
      url: `https://www.gov.uk/foreign-travel-advice/${slug}`,
      alertStatus: data.details?.alert_status ?? [],
      // The first couple of paragraphs carry the actual warning; the rest of
      // this part is boilerplate about buying insurance.
      summary: text ? text.split("\n\n").slice(0, 2).join("\n\n") : null,
      updatedAt: data.public_updated_at ?? null,
      reviewedAt: data.details?.reviewed_at ?? null,
    };
  } catch {
    return null;
  }
}

/** Human-readable version of FCDO's alert_status machine values. */
export function fcdoAlertLabel(status: string): string {
  const map: Record<string, string> = {
    avoid_all_travel_to_whole_country: "FCDO advises against all travel",
    avoid_all_but_essential_travel_to_whole_country:
      "FCDO advises against all but essential travel",
    avoid_all_travel_to_parts: "FCDO advises against all travel to parts of this country",
    avoid_all_but_essential_travel_to_parts:
      "FCDO advises against all but essential travel to parts of this country",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

// The State Dept feed's own country names, mapped from the short forms this
// project stores. Only names that differ need an entry.
const STATE_DEPT_NAME_ALIASES: Record<string, string> = {
  UAE: "United Arab Emirates",
  USA: "United States",
  UK: "United Kingdom",
};

/**
 * Compare a feed title's country to ours. EXACT match only, after stripping
 * the "Travel Advisory" suffix the feed adds to some entries — deliberately no
 * prefix or substring fallback, because that is how "Niger" matches Nigeria,
 * "Guinea" matches Guinea-Bissau, and "Sudan" matches South Sudan.
 */
function stateDeptNameMatches(feedTitleCountry: string, ourCountry: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+travel\s+advisory$/, "")
      // Punctuation becomes a separator, not nothing: deleting it outright
      // collapses "Timor-Leste" to "timorleste", which then fails to match
      // "Timor Leste" written with a space.
      .replace(/[^a-z]+/g, " ")
      .trim();
  const expected = normalize(STATE_DEPT_NAME_ALIASES[ourCountry] ?? ourCountry);
  return normalize(feedTitleCountry) === expected;
}

/**
 * Match on the country NAME, not on the feed's Country-Tag.
 *
 * This looks like the wrong choice and isn't. The feed's Country-Tag is a
 * FIPS 10-4 / GENC code, NOT ISO 3166-1 — Japan is "JA", Vietnam "VM", Serbia
 * "RI", Sri Lanka "CE", Turkey "TU", Philippines "RP". Matching our ISO codes
 * against it doesn't merely miss: the two schemes collide, and the collisions
 * are silent and wrong. Verified against the live feed, an ISO-code lookup
 * returned **Madagascar's** advisory for Morocco (both "MA"/"MO" confusion via
 * ISO MA = Morocco, FIPS MA = Madagascar) and **Russia's Level 4 "Do not
 * travel"** for Serbia (ISO RS = Serbia, FIPS RS = Russia). Showing a
 * traveller the wrong country's safety advisory is exactly the class of error
 * this project exists not to make, so: names, exact, or nothing.
 *
 * The USA has no entry in this feed at all — it's the US government advising
 * on everywhere else — so a null for "USA" is correct, not a failure.
 */
// The advisory feed is a single ~1MB XML document covering every country, and
// a page can ask about several. Next's fetch cache handles repeats across
// requests, but not concurrent calls inside one render — and travel.state.gov
// throttles: hammering it returns a short non-feed body rather than an error
// status, which would read as "no advisory" for every country at once. So the
// in-flight fetch is shared process-wide and the body is sanity-checked before
// being parsed.
let feedCache: { at: number; body: string | null } | null = null;
let feedInFlight: Promise<string | null> | null = null;
const FEED_TTL_MS = 60 * 60 * 1000;

async function getAdvisoryFeed(): Promise<string | null> {
  if (feedCache && Date.now() - feedCache.at < FEED_TTL_MS) return feedCache.body;
  if (feedInFlight) return feedInFlight;

  feedInFlight = (async () => {
    try {
      const res = await fetch("https://travel.state.gov/_res/rss/TAsTWs.xml", {
        next: { revalidate: SIX_HOURS },
      });
      if (!res.ok) return null;
      const xml = await res.text();
      // A throttled or error response comes back 200 with a short body that
      // has no items. Treat that as "couldn't fetch", not "no advisories" —
      // and don't cache it, so the next request tries again.
      if (!xml.includes("<item>")) return null;
      feedCache = { at: Date.now(), body: xml };
      return xml;
    } catch {
      return null;
    } finally {
      feedInFlight = null;
    }
  })();

  return feedInFlight;
}

export async function getStateDeptAdvisory(
  country: string | null | undefined
): Promise<StateDeptAdvisory | null> {
  if (!country) return null;
  try {
    const xml = await getAdvisoryFeed();
    if (!xml) return null;

    const items = xml.split("<item>").slice(1);
    for (const raw of items) {
      const title = /<title>([^<]*)<\/title>/.exec(raw)?.[1]?.trim() ?? "";
      if (!title) continue;
      // Titles read "Japan - Level 1: Exercise Normal Precautions".
      const titleCountry = title.split(" - ")[0]?.trim() ?? "";
      if (!stateDeptNameMatches(titleCountry, country)) continue;

      const threat =
        /<category domain="Threat-Level">([^<]+)<\/category>/.exec(raw)?.[1]?.trim() ?? "";
      const link = /<link>([^<]+)<\/link>/.exec(raw)?.[1]?.trim() ?? "";
      const pubDate = /<pubDate>([^<]+)<\/pubDate>/.exec(raw)?.[1]?.trim() ?? null;

      const levelMatch = /Level\s+(\d)/.exec(threat || title);
      return {
        country: titleCountry,
        level: levelMatch ? Number(levelMatch[1]) : null,
        levelText: threat || title,
        url:
          link ||
          "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html",
        publishedAt: pubDate,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Exported for tests — see the collision note on getStateDeptAdvisory. */
export const __testing = { stateDeptNameMatches, fcdoSlugFor };

export const STATE_DEPT_LEVEL_CLASSES: Record<number, string> = {
  1: "bg-forest/10 text-forest",
  2: "bg-stamp/10 text-stamp",
  3: "bg-stampRed/10 text-stampRed",
  4: "bg-stampRed/20 text-stampRed",
};
