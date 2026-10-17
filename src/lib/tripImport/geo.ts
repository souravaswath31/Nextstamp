// Geocoding (MapTiler) and routing (OpenRouteService), each behind a tiny
// interface so the provider can be swapped without touching the planner.
// Both are optional: without a key the planner says so and shows stops
// unordered / off the map instead of guessing.

export type LatLng = { lat: number; lng: number };

export type GeocodeHit = LatLng & { label: string; relevance: number };

type FetchLike = typeof fetch;

const MIN_RELEVANCE = 0.75;

export function geocodingEnabled(): boolean {
  return Boolean(process.env.MAPTILER_SERVER_KEY || process.env.NEXT_PUBLIC_MAPTILER_KEY);
}
export function routingEnabled(): boolean {
  return Boolean(process.env.ORS_API_KEY);
}

export function parseGeocodeResponse(json: unknown): GeocodeHit | null {
  const feats = (json as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(feats) || feats.length === 0) return null;
  const f = feats[0] as {
    center?: unknown; relevance?: unknown; place_name?: unknown; place_name_en?: unknown;
    geometry?: { coordinates?: unknown };
  };
  const coords = (Array.isArray(f.center) ? f.center : f.geometry?.coordinates) as unknown[] | undefined;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const relevance = typeof f.relevance === "number" ? f.relevance : 0;
  if (relevance < MIN_RELEVANCE) return null;
  const label = String(f.place_name_en ?? f.place_name ?? "");
  return { lat, lng, label, relevance };
}

export async function geocode(
  name: string,
  area: string | null,
  countryCode: string | null,
  fetchImpl: FetchLike = fetch
): Promise<GeocodeHit | null> {
  const key = process.env.MAPTILER_SERVER_KEY || process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!key) return null;
  const q = [name, area].filter(Boolean).join(", ");
  const params = new URLSearchParams({ key, limit: "1", language: "en" });
  if (countryCode) params.set("country", countryCode.toLowerCase());
  try {
    const res = await fetchImpl(`https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?${params}`, {
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return null;
    return parseGeocodeResponse(await res.json());
  } catch {
    return null;
  }
}

/** Square matrix of driving seconds, null where no route exists. Rows/cols follow `points`. */
export type DurationMatrix = (number | null)[][];

export function parseMatrixResponse(json: unknown, n: number): DurationMatrix | null {
  const d = (json as { durations?: unknown } | null)?.durations;
  if (!Array.isArray(d) || d.length !== n) return null;
  const out: DurationMatrix = [];
  for (const row of d) {
    if (!Array.isArray(row) || row.length !== n) return null;
    out.push(row.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null)));
  }
  return out;
}

export async function drivingMatrix(points: LatLng[], fetchImpl: FetchLike = fetch): Promise<DurationMatrix | null> {
  const key = process.env.ORS_API_KEY;
  if (!key || points.length < 2 || points.length > 25) return null;
  try {
    const res = await fetchImpl("https://api.openrouteservice.org/v2/matrix/driving-car", {
      method: "POST",
      headers: { authorization: key, "content-type": "application/json" },
      body: JSON.stringify({ locations: points.map((p) => [p.lng, p.lat]), metrics: ["duration"] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return parseMatrixResponse(await res.json(), points.length);
  } catch {
    return null;
  }
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
