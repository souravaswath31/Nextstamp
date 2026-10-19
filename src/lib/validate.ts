// Input checks for server actions. A server action is a public POST endpoint: the browser form is a
// courtesy, not a guarantee. These helpers cap lengths, ranges and shapes so one bad request cannot
// store junk, overflow a column, or break a trip page for every collaborator.
import type { TripDay } from "./types";

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** Trimmed text with control characters removed, cut to `max` characters. */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(CONTROL, "").trim().slice(0, max);
}

/** A YYYY-MM-DD string that is a real calendar date between 1900 and 2100, as noon UTC; otherwise null. */
export function isoDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return null;
  const d = new Date(`${raw.trim()}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 1900 || y > 2100) return null;
  // Reject 2026-02-31 style dates that Date silently rolls over.
  return d.toISOString().slice(0, 10) === raw.trim() ? d : null;
}

export function currencyCode(raw: unknown): string | null {
  const c = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

/** Largest amount, in minor units, that fits the Int column with room for conversion. */
export const MAX_MINOR = 1_000_000_000;

export function coordinate(v: unknown, kind: "lat" | "lon"): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const limit = kind === "lat" ? 90 : 180;
  return Math.abs(v) <= limit ? v : null;
}

export const MAX_TRIP_DAYS = 60;

/** Rebuilds a day list from untrusted input, keeping only known fields within sane limits. */
export function cleanTripDays(input: unknown): TripDay[] {
  if (!Array.isArray(input)) throw new Error("That trip plan could not be saved.");
  if (input.length > MAX_TRIP_DAYS) throw new Error(`A trip can have at most ${MAX_TRIP_DAYS} days.`);
  return input.map((raw, i) => {
    const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const activities = Array.isArray(d.activities)
      ? d.activities.slice(0, 30).map((a) => cleanText(a, 300)).filter(Boolean)
      : [];
    const num = Number(d.dayNumber);
    const out: TripDay = {
      dayNumber: Number.isInteger(num) && num >= 1 && num <= MAX_TRIP_DAYS ? num : i + 1,
      title: cleanText(d.title, 120) || `Day ${i + 1}`,
      activities,
    };
    const drive = cleanText(d.driveTime, 120);
    const stay = cleanText(d.lodgingSuggestion, 160);
    const wifi = cleanText(d.coffeeWifiSpot, 160);
    if (drive) out.driveTime = drive;
    if (stay) out.lodgingSuggestion = stay;
    if (wifi) out.coffeeWifiSpot = wifi;
    const lat = coordinate(d.latitude, "lat");
    const lon = coordinate(d.longitude, "lon");
    if (lat !== null && lon !== null) {
      out.latitude = lat;
      out.longitude = lon;
    }
    return out;
  });
}
