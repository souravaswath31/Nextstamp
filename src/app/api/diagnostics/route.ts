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
export async function GET() {
  return NextResponse.json({
    weatherApiKeySet: isWeatherConfigured(),
    mapTilerKeySet: Boolean(process.env.NEXT_PUBLIC_MAPTILER_KEY),
  });
}
