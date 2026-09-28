import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getWeatherOutlook, isWeatherConfigured, formatForecastDate } from "./weather";
import type { CountryClimate } from "@prisma/client";

// The interesting logic here is the decision of *which* answer to give — a
// real forecast or the seeded normals — and every branch of that decision is
// reachable without a key or a network call. With no key set the module must
// never reach for the network at all, which is also what makes these tests
// deterministic.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const normals: CountryClimate[] = MONTHS.map((month, i) => ({
  id: `c${i + 1}`,
  countryFactId: "f1",
  monthNumber: i + 1,
  month,
  avgHighC: 18,
  avgLowC: 9,
  precipitationNote: null,
  crowdNote: null,
  rating: "shoulder",
}));

const asOf = new Date("2027-01-10T12:00:00Z");
const day = (n: number) => new Date(asOf.getTime() + n * 86_400_000);

describe("isWeatherConfigured", () => {
  const original = process.env.WEATHER_API_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.WEATHER_API_KEY;
    else process.env.WEATHER_API_KEY = original;
  });

  it("is false with no key and true with one", () => {
    delete process.env.WEATHER_API_KEY;
    expect(isWeatherConfigured()).toBe(false);
    process.env.WEATHER_API_KEY = "test-key";
    expect(isWeatherConfigured()).toBe(true);
  });
});

describe("getWeatherOutlook", () => {
  const original = process.env.WEATHER_API_KEY;
  beforeEach(() => {
    // No key: the module must fall back without touching the network.
    delete process.env.WEATHER_API_KEY;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.WEATHER_API_KEY;
    else process.env.WEATHER_API_KEY = original;
  });

  it("falls back to normals when no key is configured", async () => {
    const out = await getWeatherOutlook("Tokyo", day(3), day(8), normals, "Tokyo", asOf);
    expect(out?.kind).toBe("normals");
  });

  it("returns null when there's no key AND no normals — nothing honest to show", async () => {
    const out = await getWeatherOutlook("Tokyo", day(3), day(8), [], null, asOf);
    expect(out).toBeNull();
  });

  it("falls back to normals with no start date", async () => {
    process.env.WEATHER_API_KEY = "test-key";
    const out = await getWeatherOutlook("Tokyo", null, null, normals, "Tokyo", asOf);
    expect(out?.kind).toBe("normals");
  });

  it("falls back to normals with no place to query", async () => {
    process.env.WEATHER_API_KEY = "test-key";
    const out = await getWeatherOutlook(null, day(3), day(8), normals, "Tokyo", asOf);
    expect(out?.kind).toBe("normals");
  });

  it("falls back to normals for a trip beyond any forecast window", async () => {
    // 60 days out: no provider has a real forecast, and buying a long-range
    // "forecast" endpoint to pretend otherwise is the thing we declined to do.
    process.env.WEATHER_API_KEY = "test-key";
    const out = await getWeatherOutlook("Tokyo", day(60), day(68), normals, "Tokyo", asOf);
    expect(out?.kind).toBe("normals");
  });

  it("falls back to normals for a trip that has already started", async () => {
    process.env.WEATHER_API_KEY = "test-key";
    const out = await getWeatherOutlook("Tokyo", day(-5), day(2), normals, "Tokyo", asOf);
    expect(out?.kind).toBe("normals");
  });

  it("carries the reference city through to the normals answer", async () => {
    const out = await getWeatherOutlook("Tokyo", day(90), day(95), normals, "Kyoto", asOf);
    expect(out).toMatchObject({ kind: "normals", referenceCity: "Kyoto" });
  });
});

describe("formatForecastDate", () => {
  it("formats in UTC so a yyyy-mm-dd never slips a day west of Greenwich", () => {
    expect(formatForecastDate("2027-03-14")).toBe("Sun, Mar 14");
  });
});
