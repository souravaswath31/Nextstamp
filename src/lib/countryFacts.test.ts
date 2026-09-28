import { describe, it, expect } from "vitest";
import { climateForDateRange, parseTransitPasses, splitList, splitSources } from "./countryFacts";
import type { CountryClimate } from "@prisma/client";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const climate: CountryClimate[] = MONTHS.map((month, i) => ({
  id: `c${i + 1}`,
  countryFactId: "f1",
  monthNumber: i + 1,
  month,
  avgHighC: 20,
  avgLowC: 10,
  precipitationNote: null,
  crowdNote: null,
  rating: "shoulder",
}));

const utc = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

describe("climateForDateRange", () => {
  it("returns nothing without a start date", () => {
    expect(climateForDateRange(climate, null, utc("2027-03-22"))).toEqual([]);
  });

  it("returns one month for a trip inside a single month", () => {
    const result = climateForDateRange(climate, utc("2027-03-04"), utc("2027-03-19"));
    expect(result.map((c) => c.month)).toEqual(["March"]);
  });

  it("returns both months for a trip that straddles a boundary", () => {
    const result = climateForDateRange(climate, utc("2027-03-28"), utc("2027-04-05"));
    expect(result.map((c) => c.month)).toEqual(["March", "April"]);
  });

  it("orders by the trip's own calendar, not the year's, across New Year", () => {
    // A late-December-to-January trip should read December then January, not
    // January then December.
    const result = climateForDateRange(climate, utc("2027-12-27"), utc("2028-01-06"));
    expect(result.map((c) => c.month)).toEqual(["December", "January"]);
  });

  it("treats a missing end date as a single-day trip", () => {
    const result = climateForDateRange(climate, utc("2027-07-15"), null);
    expect(result.map((c) => c.month)).toEqual(["July"]);
  });

  it("ignores an end date before the start instead of returning nothing", () => {
    const result = climateForDateRange(climate, utc("2027-07-15"), utc("2027-07-01"));
    expect(result.map((c) => c.month)).toEqual(["July"]);
  });

  it("caps at twelve months for an absurdly long range", () => {
    const result = climateForDateRange(climate, utc("2027-01-05"), utc("2031-01-05"));
    expect(result).toHaveLength(12);
    expect(result[0].month).toBe("January");
  });

  it("skips a month with no row rather than returning a hole", () => {
    const sparse = climate.filter((c) => c.monthNumber !== 4);
    const result = climateForDateRange(sparse, utc("2027-03-28"), utc("2027-04-05"));
    expect(result.map((c) => c.month)).toEqual(["March"]);
  });
});

describe("splitList / splitSources", () => {
  it("splits and trims, dropping empties", () => {
    expect(splitList("A, B ,,C")).toEqual(["A", "B", "C"]);
    expect(splitList("")).toEqual([]);
    expect(splitList(null)).toEqual([]);
  });

  it("splits sources on the pipe, since URLs contain commas", () => {
    expect(splitSources("https://a.gov/x?a=1,2|https://b.gov")).toEqual([
      "https://a.gov/x?a=1,2",
      "https://b.gov",
    ]);
  });
});

describe("parseTransitPasses", () => {
  it("parses a well-formed list", () => {
    const json = JSON.stringify([
      { name: "Japan Rail Pass", covers: "JR lines", worth_it: "Only long-distance", buy_before_arrival: false },
    ]);
    expect(parseTransitPasses(json)).toHaveLength(1);
    expect(parseTransitPasses(json)[0].name).toBe("Japan Rail Pass");
  });

  it("degrades to an empty list rather than throwing on bad data", () => {
    // A page render must not die because one seed row has malformed JSON.
    expect(parseTransitPasses("not json")).toEqual([]);
    expect(parseTransitPasses('{"name":"not an array"}')).toEqual([]);
    expect(parseTransitPasses("")).toEqual([]);
    expect(parseTransitPasses(null)).toEqual([]);
  });

  it("drops entries with no name", () => {
    expect(parseTransitPasses('[{"covers":"x"},{"name":"Real"}]')).toHaveLength(1);
  });
});
