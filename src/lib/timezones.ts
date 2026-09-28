// Timezone math from the IANA zone stored on CountryFact.
//
// The roadmap proposed tz-lookup (offline lat/lng → zone). We don't need it:
// a trip has a destination country, not a coordinate, and a country-level
// zone from the curated data set is both more accurate for this use and one
// fewer dependency. If per-place maps ever land, revisit — a coordinate is
// where tz-lookup earns its keep.
//
// Everything here uses Intl, which ships with Node and the browser and knows
// the current DST rules, rather than storing a fixed UTC offset that would
// silently go wrong twice a year.

export type ZoneReading = {
  zone: string;
  /** Local wall-clock time in the destination, e.g. "9:42 PM". */
  localTime: string;
  /** Local day, e.g. "Sun, Sep 28". */
  localDate: string;
  /** Short zone name where the platform has one, e.g. "JST". */
  abbreviation: string | null;
  /** Minutes ahead of (positive) or behind (negative) the viewer's zone. */
  offsetMinutesFromViewer: number;
  /** "8 hours ahead of you" — already phrased, including the same-zone case. */
  relativeToViewer: string;
};

function offsetMinutes(zone: string, at: Date): number {
  // Formatting the same instant in the target zone and in UTC, then
  // differencing, gives the zone's offset without a table of DST rules.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
}

function describeDelta(minutes: number): string {
  if (minutes === 0) return "Same time as you";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (mins > 0) parts.push(`${mins} min`);
  return `${parts.join(" ")} ${minutes > 0 ? "ahead of" : "behind"} you`;
}

/**
 * @param viewerZone the reader's own IANA zone. On the server there is no
 * such thing, so callers pass the value from the browser (or fall back to
 * UTC and say so) rather than pretending the server's zone is the user's.
 */
export function readZone(zone: string, viewerZone: string, at: Date = new Date()): ZoneReading | null {
  if (!zone) return null;
  try {
    const localTime = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
    }).format(at);

    const localDate = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(at);

    const abbreviation =
      new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" })
        .formatToParts(at)
        .find((p) => p.type === "timeZoneName")?.value ?? null;

    const delta = offsetMinutes(zone, at) - offsetMinutes(viewerZone || "UTC", at);

    return {
      zone,
      localTime,
      localDate,
      abbreviation,
      offsetMinutesFromViewer: delta,
      relativeToViewer: describeDelta(delta),
    };
  } catch {
    // An unrecognised zone string shouldn't break a page.
    return null;
  }
}

/**
 * Rough jet-lag guidance based on how many zones you cross and in which
 * direction. The "one day per hour" rule of thumb and the fact that eastward
 * travel is harder than westward are both long-standing sleep-medicine
 * guidance, not our invention — but this is a rule of thumb, and the copy
 * says so rather than implying a clinical prediction.
 */
export function jetLagNote(offsetMinutesFromViewer: number): string | null {
  const hours = Math.round(Math.abs(offsetMinutesFromViewer) / 60);
  if (hours < 3) return null;
  const direction = offsetMinutesFromViewer > 0 ? "eastward" : "westward";
  const harder = offsetMinutesFromViewer > 0;
  return `You're crossing about ${hours} hours ${direction}. A common rule of thumb is roughly a day of adjustment per hour crossed${harder ? ", and eastward trips usually take longer to shake off than westward ones" : ""} — worth keeping the first day light.`;
}

export function formatArrivalLocal(departureLocal: Date, zone: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(departureLocal);
  } catch {
    return null;
  }
}
