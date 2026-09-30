import { NextResponse } from "next/server";
import { isWeatherConfigured } from "@/lib/weather";

// Temporary, unauthenticated, and deliberately narrow: reports whether each
// optional integration's env var is SET (a non-empty string), never the value
// itself. Added once, to verify the WeatherAPI and MapTiler keys took effect
// on a fresh Vercel deploy without needing a login — the weather panel only
// renders on the trip page, which is behind auth, so there was previously no
// way to check it without a real session. Removed once confirmed; if you're
// reading this in a later session and this route still exists, it's safe to
// delete it — its only job was this one check.
async function weatherApiKeyIsValid(): Promise<"unset" | "valid" | "invalid" | "unknown"> {
  const key = process.env.WEATHER_API_KEY;
  if (!key) return "unset";
  try {
    // A live call, not just a presence check — a typo'd key still passes
    // isWeatherConfigured(). "London" is fixed and arbitrary; the point is
    // only whether WeatherAPI accepts the key, never what it returns.
    const res = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${encodeURIComponent(key)}&q=London`,
      { cache: "no-store" }
    );
    if (res.ok) return "valid";
    if (res.status === 401 || res.status === 403) return "invalid";
    return "unknown"; // e.g. a transient 5xx from their side, not our key's fault
  } catch {
    return "unknown";
  }
}

export async function GET() {
  return NextResponse.json({
    weatherApiKeySet: isWeatherConfigured(),
    weatherApiKeyStatus: await weatherApiKeyIsValid(),
    mapTilerKeySet: Boolean(process.env.NEXT_PUBLIC_MAPTILER_KEY),
  });
}
