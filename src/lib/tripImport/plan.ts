// Turns resolved stops into the draft trip the user reviews. Pure.

import { formatDrive, groupIntoDays, orderStops } from "./order";
import { haversineKm, type DurationMatrix, type LatLng } from "./geo";

export type StopOrigin = "post" | "suggested";

export type DraftStop = {
  id: string;
  name: string;
  /** "post": the source names it. "suggested": one of our own guides' places, offered, not from the post. */
  origin: StopOrigin;
  quote: string | null;
  area: string | null;
  lat: number | null;
  lng: number | null;
  locatedBy: "guide" | "lookup" | null;
  guideSlug: string | null;
  note: string | null;
};

export type DraftDay = { stopIds: string[]; drive: string | null };

export type Ordering =
  | { kind: "ordered"; days: DraftDay[] }
  | { kind: "unordered"; reason: string };

export type DraftTrip = {
  title: string;
  destinationCountry: string | null;
  stops: DraftStop[];
  ordering: Ordering;
  /** Plain-language notes shown on the review screen. */
  notes: string[];
};

/** Beyond this the stops are on different trips for routing purposes (or different continents). */
export const MAX_SPREAD_KM = 2500;

export function hasPoint(s: DraftStop): s is DraftStop & { lat: number; lng: number } {
  return s.lat !== null && s.lng !== null;
}

export function routable(stops: DraftStop[]): { ok: true } | { ok: false; reason: string } {
  const located = stops.filter(hasPoint);
  if (located.length < 2) {
    return { ok: false, reason: "Fewer than two stops could be placed on a map, so there is nothing to put in order." };
  }
  for (let i = 0; i < located.length; i++) {
    for (let j = i + 1; j < located.length; j++) {
      if (haversineKm(located[i] as LatLng, located[j] as LatLng) > MAX_SPREAD_KM) {
        return { ok: false, reason: "These stops are too far apart to drive between, so they are shown unordered." };
      }
    }
  }
  return { ok: true };
}

export async function buildOrdering(
  stops: DraftStop[],
  matrixFor: (points: LatLng[]) => Promise<DurationMatrix | null>,
  routingConfigured: boolean
): Promise<{ ordering: Ordering; notes: string[] }> {
  const check = routable(stops);
  if (!check.ok) return { ordering: { kind: "unordered", reason: check.reason }, notes: [] };
  if (!routingConfigured) {
    return {
      ordering: {
        kind: "unordered",
        reason: "Drive times and ordering come from a routing service, and none is connected yet. Stops are shown unordered.",
      },
      notes: [],
    };
  }
  const located = stops.filter(hasPoint);
  const matrix = await matrixFor(located.map((s) => ({ lat: s.lat, lng: s.lng })));
  const order = matrix ? orderStops(matrix) : null;
  if (!matrix || !order) {
    return {
      ordering: {
        kind: "unordered",
        reason: "The routing service couldn't find drivable routes between all of these stops, so they are shown unordered.",
      },
      notes: [],
    };
  }
  const days = groupIntoDays(order, matrix).map<DraftDay>((d) => ({
    stopIds: d.stops.map((i) => located[i].id),
    drive: formatDrive(d.driveSeconds),
  }));
  const notes = [
    "Order and drive times come from a routing service's driving times. Opening hours and traffic aren't included.",
  ];
  const unlocated = stops.filter((s) => !hasPoint(s));
  if (unlocated.length) {
    notes.push(
      `${unlocated.length} stop${unlocated.length === 1 ? "" : "s"} couldn't be placed on the map, so ${
        unlocated.length === 1 ? "it isn't" : "they aren't"
      } in the order. ${unlocated.length === 1 ? "It's" : "They're"} saved with the trip to place by hand.`
    );
  }
  return { ordering: { kind: "ordered", days }, notes };
}

export function titleFor(extractedTitle: string | null, stops: DraftStop[]): string {
  if (extractedTitle) return extractedTitle;
  const first = stops.find((s) => s.origin === "post");
  return first ? `Trip from a post: ${first.name}` : "Trip from a post";
}
