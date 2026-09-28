import type { CountryClimate } from "@prisma/client";

/**
 * Weather for a trip's actual dates.
 *
 * Source: WeatherAPI.com — free key, no credit card, ~1M calls/month.
 *
 * **Why not Open-Meteo**, which needs no key at all: its free tier is
 * explicitly non-commercial, and NextStamp is intended to carry a one-time
 * purchase eventually. A licence problem is a worse trade than a signup.
 *
 * **The forecast-window problem, and why we don't pay to solve it.** A real
 * forecast only exists a couple of weeks out, and most trips are planned
 * further ahead than that. WeatherAPI sells a `future.json` endpoint for
 * 14–300 days, but we don't need it: the country-guide data set already
 * carries month-by-month climate normals from each country's own
 * meteorological service. So this module returns a *forecast* when the dates
 * are close enough for one to mean anything, and otherwise hands back the
 * seeded normals clearly labelled as averages rather than a prediction. That's
 * both cheaper and more honest than a "forecast" for next April.
 *
 * With no key set, everything here returns null and the UI omits the section.
 * The app must work fine without it.
 */

export type ForecastDay = {
  date: string; // yyyy-mm-dd
  maxC: number;
  minC: number;
  conditionText: string;
  /** WeatherAPI's own icon URL, protocol-relative in their payload. */
  iconUrl: string | null;
  chanceOfRain: number | null;
  totalPrecipMm: number | null;
};

export type WeatherOutlook =
  | { kind: "forecast"; days: ForecastDay[]; location: string | null }
  | { kind: "normals"; months: CountryClimate[]; referenceCity: string | null }
  | null;

const WEATHER_BASE = "https://api.weatherapi.com/v1";
/** Forecasts churn; an hour of caching is plenty and keeps call volume trivial. */
const ONE_HOUR = 3600;

export function isWeatherConfigured(): boolean {
  return Boolean(process.env.WEATHER_API_KEY);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysFromNow(d: Date, asOf: Date): number {
  const a = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const b = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

/**
 * How far ahead WeatherAPI's forecast endpoint will actually go depends on the
 * plan the key is on (free keys are the shortest). Rather than hardcode a
 * number that may be wrong, we ask for what the trip needs, capped at the
 * longest any plan offers, and use whatever days come back — if the response
 * doesn't reach the trip, we fall through to normals.
 */
const MAX_FORECAST_DAYS_ANY_PLAN = 14;

async function fetchForecast(
  query: string,
  days: number
): Promise<{ days: ForecastDay[]; location: string | null } | null> {
  const key = process.env.WEATHER_API_KEY;
  if (!key) return null;

  const url =
    `${WEATHER_BASE}/forecast.json?key=${encodeURIComponent(key)}` +
    `&q=${encodeURIComponent(query)}&days=${days}&aqi=no&alerts=no`;

  try {
    const res = await fetch(url, { next: { revalidate: ONE_HOUR } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      location?: { name?: string; country?: string };
      forecast?: {
        forecastday?: {
          date?: string;
          day?: {
            maxtemp_c?: number;
            mintemp_c?: number;
            totalprecip_mm?: number;
            daily_chance_of_rain?: number;
            condition?: { text?: string; icon?: string };
          };
        }[];
      };
    };

    const rows = data.forecast?.forecastday ?? [];
    if (rows.length === 0) return null;

    const parsed: ForecastDay[] = rows
      .filter((r) => r.date && r.day)
      .map((r) => ({
        date: r.date!,
        maxC: Math.round(r.day!.maxtemp_c ?? 0),
        minC: Math.round(r.day!.mintemp_c ?? 0),
        conditionText: r.day!.condition?.text ?? "",
        // WeatherAPI returns "//cdn.weatherapi.com/..." — give it a scheme.
        iconUrl: r.day!.condition?.icon
          ? r.day!.condition.icon.startsWith("//")
            ? `https:${r.day!.condition.icon}`
            : r.day!.condition.icon
          : null,
        chanceOfRain:
          typeof r.day!.daily_chance_of_rain === "number" ? r.day!.daily_chance_of_rain : null,
        totalPrecipMm:
          typeof r.day!.totalprecip_mm === "number" ? r.day!.totalprecip_mm : null,
      }));

    if (parsed.length === 0) return null;

    const loc = data.location?.name
      ? [data.location.name, data.location.country].filter(Boolean).join(", ")
      : null;
    return { days: parsed, location: loc };
  } catch {
    return null;
  }
}

/**
 * @param query what to ask WeatherAPI about — a city name works better than a
 * country ("Japan" resolves to somewhere arbitrary), so callers should pass
 * the country guide's own climate reference city where there is one.
 */
export async function getWeatherOutlook(
  query: string | null | undefined,
  startDate: Date | null,
  endDate: Date | null,
  normals: CountryClimate[],
  referenceCity: string | null,
  asOf: Date = new Date()
): Promise<WeatherOutlook> {
  const fallback = (): WeatherOutlook =>
    normals.length > 0 ? { kind: "normals", months: normals, referenceCity } : null;

  if (!startDate || !query || !isWeatherConfigured()) return fallback();

  const startOffset = daysFromNow(startDate, asOf);
  // Already over, or too far out for any real forecast.
  if (startOffset < 0 || startOffset > MAX_FORECAST_DAYS_ANY_PLAN) return fallback();

  const endOffset = endDate ? daysFromNow(endDate, asOf) : startOffset;
  const needed = Math.min(MAX_FORECAST_DAYS_ANY_PLAN, Math.max(1, endOffset + 1));

  const forecast = await fetchForecast(query, needed);
  if (!forecast) return fallback();

  // Keep only the days inside the trip. A free key may return fewer days than
  // asked for; if none of them reach the trip, normals are the honest answer.
  const from = isoDate(startDate);
  const to = isoDate(endDate ?? startDate);
  const within = forecast.days.filter((d) => d.date >= from && d.date <= to);
  if (within.length === 0) return fallback();

  return { kind: "forecast", days: within, location: forecast.location };
}

export function formatForecastDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
