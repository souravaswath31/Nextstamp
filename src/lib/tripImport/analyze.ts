// The server-side pipeline: source -> places -> match/locate -> order. Each
// network or DB dependency is injectable so the pipeline is testable without
// any of them.

import { prisma } from "@/lib/prisma";
import { normalizeCountryInput } from "@/lib/countries";
import { extractPlaces, type ImageInput } from "./extract";
import { normalize, type Extraction } from "./extraction";
import { drivingMatrix, geocode, geocodingEnabled, routingEnabled, type DurationMatrix, type GeocodeHit, type LatLng } from "./geo";
import { matchGuidePlace, suggestFromGuide, type GuidePlace } from "./guideMatch";
import { buildOrdering, titleFor, type DraftStop, type DraftTrip } from "./plan";
import { readSourceUrl } from "./source";
import type { Platform } from "./sourceUrl";

export const MAX_TEXT_CHARS = 8000;

export type ImportMode = "link" | "text" | "screenshots";

export type SourceRecord = {
  kind: ImportMode;
  platform: Platform | null;
  url: string | null;
  text: string | null;
};

export type Deps = {
  extract: (input: { text?: string; images?: ImageInput[] }) => Promise<Extraction>;
  readUrl: typeof readSourceUrl;
  loadGuide: () => Promise<GuidePlace[]>;
  iso2For: (country: string) => Promise<string | null>;
  geocode: (name: string, area: string | null, iso2: string | null) => Promise<GeocodeHit | null>;
  matrix: (points: LatLng[]) => Promise<DurationMatrix | null>;
  geocodingOn: boolean;
  routingOn: boolean;
};

export const realDeps = (): Deps => ({
  extract: (i) => extractPlaces(i),
  readUrl: readSourceUrl,
  loadGuide: loadGuidePlaces,
  iso2For: async (country) => {
    const f = await prisma.countryFact.findUnique({ where: { country }, select: { iso2: true } });
    return f?.iso2 ?? null;
  },
  geocode: (n, a, c) => geocode(n, a, c),
  matrix: (pts) => drivingMatrix(pts),
  geocodingOn: geocodingEnabled(),
  routingOn: routingEnabled(),
});

async function loadGuidePlaces(): Promise<GuidePlace[]> {
  const rows = await prisma.statePlace.findMany({
    select: {
      name: true, nearestTown: true, latitude: true, longitude: true, description: true,
      stateGuide: { select: { slug: true, name: true } },
    },
  });
  return rows.map((r) => ({
    name: r.name, nearestTown: r.nearestTown, latitude: r.latitude, longitude: r.longitude,
    description: r.description, stateSlug: r.stateGuide.slug, stateName: r.stateGuide.name,
  }));
}

export type AnalyzeResult =
  | { ok: true; draft: DraftTrip; source: SourceRecord }
  | { ok: false; reason: string };

function canonicalUrl(raw: string): string {
  const t = raw.trim();
  return new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`).toString();
}

export async function analyzeSource(
  input: { mode: ImportMode; url?: string; text?: string; images?: ImageInput[] },
  deps: Deps = realDeps()
): Promise<AnalyzeResult> {
  let text: string | undefined;
  let images: ImageInput[] | undefined;
  const source: SourceRecord = { kind: input.mode, platform: null, url: null, text: null };

  if (input.mode === "link") {
    const r = await deps.readUrl(input.url ?? "");
    if (!r.ok) return r;
    text = r.source.text.slice(0, MAX_TEXT_CHARS);
    source.platform = r.source.platform;
    source.url = canonicalUrl(input.url ?? "");
    source.text = text;
  } else if (input.mode === "text") {
    text = (input.text ?? "").trim().slice(0, MAX_TEXT_CHARS);
    if (text.length < 20) return { ok: false, reason: "Paste a bit more of the caption. We need at least a sentence to find places in." };
    source.text = text;
  } else {
    images = input.images ?? [];
    if (images.length === 0) return { ok: false, reason: "Add at least one screenshot." };
  }

  let extraction: Extraction;
  try {
    extraction = await deps.extract({ text, images });
  } catch {
    return { ok: false, reason: "We couldn't read that just now. Try again in a moment." };
  }
  if (extraction.places.length === 0) {
    return {
      ok: false,
      reason:
        "We couldn't find any named places in that. If the post only shows scenery without naming where, there's nothing for us to pull out. Try pasting the caption or comments that name the spots.",
    };
  }

  const guide = await deps.loadGuide();
  const stops: DraftStop[] = [];
  const matchedGuide: GuidePlace[] = [];
  let country = extraction.destinationCountry ? normalizeCountryInput(extraction.destinationCountry) : null;

  // Our own guides first.
  const unresolved: { idx: number; name: string; area: string | null }[] = [];
  extraction.places.forEach((p, i) => {
    const g = matchGuidePlace(p.name, p.area, guide);
    const base: DraftStop = {
      id: `p${i}`, name: p.name, origin: "post", quote: p.quote, area: p.area,
      lat: null, lng: null, locatedBy: null, guideSlug: null, note: null,
    };
    if (g) {
      matchedGuide.push(g);
      stops.push({
        ...base, guideSlug: g.stateSlug,
        lat: g.latitude, lng: g.longitude, locatedBy: g.latitude !== null ? "guide" : null,
      });
      if (g.latitude === null) unresolved.push({ idx: i, name: p.name, area: p.area ?? g.stateName });
    } else {
      stops.push(base);
      unresolved.push({ idx: i, name: p.name, area: p.area });
    }
  });

  if (matchedGuide.length && !country) country = "USA";

  // Then look up what the guides didn't cover.
  const notes: string[] = [];
  if (images && images.length) {
    notes.push("These places were read from screenshots, which we can't check automatically. Look over each one against the post.");
  }
  if (unresolved.length) {
    if (!deps.geocodingOn) {
      notes.push("No place lookup is connected, so stops outside our guides can't be put on a map.");
    } else {
      const iso2 = country ? await deps.iso2For(country).catch(() => null) : null;
      const hits = await Promise.all(unresolved.map((u) => deps.geocode(u.name, u.area, iso2)));
      hits.forEach((h, k) => {
        const s = stops[unresolved[k].idx];
        if (h) { s.lat = h.lat; s.lng = h.lng; s.locatedBy = "lookup"; }
      });
      const left = stops.filter((s) => s.lat === null).length;
      if (left) {
        notes.push(`${left} stop${left === 1 ? "" : "s"} couldn't be matched to a place with confidence, so ${left === 1 ? "it stays" : "they stay"} off the map.`);
      }
    }
  }

  // Suggestions are our own guide places only, never invented.
  // A guide place already matched to a stop counts as mentioned, even when the post spelled it differently.
  const taken = new Set([...stops.map((s) => normalize(s.name)), ...matchedGuide.map((g) => normalize(g.name))]);
  suggestFromGuide(matchedGuide, taken, guide).forEach((g, k) => {
    stops.push({
      id: `s${k}`, name: g.name, origin: "suggested", quote: null, area: g.nearestTown,
      lat: g.latitude, lng: g.longitude, locatedBy: "guide", guideSlug: g.stateSlug,
      note: `Suggested by NextStamp, from our ${g.stateName} guide.`,
    });
  });

  const draft = await finalizeDraft(
    { title: titleFor(extraction.tripTitle, stops), destinationCountry: country, stops, notes },
    deps
  );
  return { ok: true, draft, source };
}

/** Orders the post-sourced stops (suggestions stay out of the route) and attaches the result. */
export async function finalizeDraft(
  d: { title: string; destinationCountry: string | null; stops: DraftStop[]; notes: string[] },
  deps: Pick<Deps, "matrix" | "routingOn">
): Promise<DraftTrip> {
  const fromPost = d.stops.filter((s) => s.origin === "post");
  const { ordering, notes } = await buildOrdering(fromPost, deps.matrix, deps.routingOn);
  return { ...d, ordering, notes: [...d.notes, ...notes] };
}
