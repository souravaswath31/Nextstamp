// Match what a post says against NextStamp's own state guides first. Pure over
// a list of guide places, so the DB lookup lives in analyze.ts.

import { normalize } from "./extraction";
import { haversineKm } from "./geo";

export type GuidePlace = {
  name: string;
  nearestTown: string | null;
  latitude: number | null;
  longitude: number | null;
  stateSlug: string;
  stateName: string;
  description: string;
};

/** Whole-word containment, so "arches" is not found inside "marches". */
function containsWords(hay: string, needle: string): boolean {
  return ` ${hay} `.includes(` ${needle} `);
}

export function matchGuidePlace(name: string, area: string | null, guide: GuidePlace[]): GuidePlace | null {
  const n = normalize(name);
  if (!n) return null;
  const hits = guide.filter((g) => {
    const gn = normalize(g.name);
    if (gn === n) return true;
    const [shorter, longer] = gn.length <= n.length ? [gn, n] : [n, gn];
    // Containment only when the shorter name is distinctive: two words, or a long single word.
    const distinctive = shorter.includes(" ") || shorter.length >= 9;
    return distinctive && containsWords(longer, shorter);
  });
  if (hits.length === 0) return null;
  const states = new Set(hits.map((h) => h.stateSlug));
  if (states.size === 1) return exactFirst(hits, n);
  // The same place name in several states: only take one if the post names the state.
  const a = area ? normalize(area) : "";
  const byArea = hits.filter((h) => a && containsWords(a, normalize(h.stateName)));
  return byArea.length && new Set(byArea.map((h) => h.stateSlug)).size === 1 ? exactFirst(byArea, n) : null;
}

function exactFirst(hits: GuidePlace[], n: string): GuidePlace {
  return hits.find((h) => normalize(h.name) === n) ?? hits[0];
}

/** Our own places in the same state that the post did not mention, nearest to what it did mention. Offered, labelled as suggestions. */
export function suggestFromGuide(
  matched: GuidePlace[],
  taken: Set<string>,
  guide: GuidePlace[],
  limit = 3
): GuidePlace[] {
  const slugs = new Set(matched.map((m) => m.stateSlug));
  if (slugs.size !== 1) return [];
  const slug = Array.from(slugs)[0];
  const anchors = matched.filter((m) => m.latitude !== null && m.longitude !== null);
  if (anchors.length === 0) return [];
  const center = {
    lat: anchors.reduce((s, m) => s + (m.latitude as number), 0) / anchors.length,
    lng: anchors.reduce((s, m) => s + (m.longitude as number), 0) / anchors.length,
  };
  return guide
    .filter((g) => g.stateSlug === slug && g.latitude !== null && g.longitude !== null && !taken.has(normalize(g.name)))
    .map((g) => ({ g, km: haversineKm(center, { lat: g.latitude as number, lng: g.longitude as number }) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
    .map((x) => x.g);
}
