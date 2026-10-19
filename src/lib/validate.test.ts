import { describe, expect, it } from "vitest";
import { cleanText, cleanTripDays, coordinate, currencyCode, isoDate } from "./validate";

describe("cleanText", () => {
  it("trims, strips control characters and caps length", () => {
    expect(cleanText("  hi\u0000 there  ", 50)).toBe("hi there");
    expect(cleanText("abcdef", 3)).toBe("abc");
    expect(cleanText(42, 5)).toBe("");
  });
});

describe("isoDate", () => {
  it("accepts real dates only", () => {
    expect(isoDate("2026-10-19")?.toISOString()).toBe("2026-10-19T12:00:00.000Z");
    expect(isoDate("2026-02-31")).toBeNull();
    expect(isoDate("not a date")).toBeNull();
    expect(isoDate("0001-01-01")).toBeNull();
    expect(isoDate("9999-01-01")).toBeNull();
  });
});

describe("currencyCode / coordinate", () => {
  it("validates shapes", () => {
    expect(currencyCode("usd")).toBe("USD");
    expect(currencyCode("US/../x")).toBeNull();
    expect(coordinate(45, "lat")).toBe(45);
    expect(coordinate(95, "lat")).toBeNull();
    expect(coordinate(NaN, "lon")).toBeNull();
  });
});

describe("cleanTripDays", () => {
  it("keeps known fields and drops the rest", () => {
    const out = cleanTripDays([
      { dayNumber: 1, title: "Arrive", activities: ["Walk", 7, ""], evil: "x", latitude: 10, longitude: 20 },
      { title: "", activities: "nope", latitude: 999, longitude: 0 },
    ]);
    expect(out[0]).toEqual({ dayNumber: 1, title: "Arrive", activities: ["Walk"], latitude: 10, longitude: 20 });
    expect(out[1]).toEqual({ dayNumber: 2, title: "Day 2", activities: [] });
  });
  it("rejects non-arrays and oversize plans", () => {
    expect(() => cleanTripDays("x")).toThrow();
    expect(() => cleanTripDays(Array.from({ length: 61 }, () => ({})))).toThrow();
  });
});
