// Turning a reviewed draft into the rows a trip is made of. Pure, so the
// shape of an imported trip is tested without a database.
//
// The client sends the draft back after the user ticks and unticks stops, so
// everything here is re-validated: it is the user's own data, but it is still
// input from a browser.

import type { TripDay } from "@/lib/types";
import { cleanLabel } from "./extraction";
import type { DraftDay, DraftStop, StopOrigin } from "./plan";

export const MAX_STOPS = 25;

export const SOURCE_KIND_POST = "import_post";
export const SOURCE_KIND_SUGGESTED = "import_suggested";

function num(v: unknown, lo: number, hi: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null;
}

export function sanitizeStops(raw: unknown): DraftStop[] {
  if (!Array.isArray(raw)) return [];
  const out: DraftStop[] = [];
  const names = new Set<string>();
  const ids = new Set<string>();
  for (const r of raw.slice(0, MAX_STOPS)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const name = cleanLabel(o.name, 80);
    const id = cleanLabel(o.id, 12);
    if (!name || !id || names.has(name.toLowerCase()) || ids.has(id)) continue;
    const origin: StopOrigin = o.origin === "suggested" ? "suggested" : "post";
    const lat = num(o.lat, -90, 90);
    const lng = num(o.lng, -180, 180);
    const located = lat !== null && lng !== null;
    names.add(name.toLowerCase());
    ids.add(id);
    out.push({
      id,
      name,
      origin,
      quote: origin === "post" ? cleanLabel(o.quote, 240) || null : null,
      area: cleanLabel(o.area, 80) || null,
      lat: located ? lat : null,
      lng: located ? lng : null,
      locatedBy: located ? (o.locatedBy === "lookup" ? "lookup" : "guide") : null,
      guideSlug: /^[a-z0-9-]{1,60}$/.test(String(o.guideSlug ?? "")) ? String(o.guideSlug) : null,
      note: origin === "suggested" ? cleanLabel(o.note, 160) || null : null,
    });
  }
  return out;
}

export type PlaceRecord = {
  name: string;
  note: string | null;
  /** The post's own words for this stop; shown beside the "From the post" label. */
  quote: string | null;
  sourceKind: string;
  sourceSlug: string | null;
  latitude: number | null;
  longitude: number | null;
  usedOnDay: number | null;
};

export type TripRecords = { days: TripDay[]; places: PlaceRecord[] };

export function buildTripRecords(stops: DraftStop[], orderedDays: DraftDay[] | null): TripRecords {
  const byId = new Map(stops.map((s) => [s.id, s]));
  const dayOf = new Map<string, number>();
  const days: TripDay[] = [];

  if (orderedDays) {
    orderedDays.forEach((d, i) => {
      const dayStops = d.stopIds.map((id) => byId.get(id)).filter((s): s is DraftStop => Boolean(s));
      if (dayStops.length === 0) return;
      const n = days.length + 1;
      const first = dayStops.find((s) => s.lat !== null && s.lng !== null);
      days.push({
        dayNumber: n,
        title: `Day ${n}: ${dayStops[0].name}`,
        activities: dayStops.map((s) => s.name),
        driveTime: d.drive,
        latitude: first?.lat ?? null,
        longitude: first?.lng ?? null,
      });
      dayStops.forEach((s) => dayOf.set(s.id, n));
      void i;
    });
  }
  if (days.length === 0) days.push({ dayNumber: 1, title: "Day 1", activities: [] });

  const places: PlaceRecord[] = stops.map((s) => ({
    name: s.name,
    // The label ("From the post" / "Suggested by NextStamp") comes from sourceKind,
    // so the note stays free for the user and out of the day's activity text.
    note: null,
    quote: s.origin === "post" ? s.quote : null,
    sourceKind: s.origin === "post" ? SOURCE_KIND_POST : SOURCE_KIND_SUGGESTED,
    sourceSlug: s.guideSlug,
    latitude: s.lat,
    longitude: s.lng,
    usedOnDay: dayOf.get(s.id) ?? null,
  }));
  return { days, places };
}
