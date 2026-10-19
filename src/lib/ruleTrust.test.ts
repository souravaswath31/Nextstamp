import { describe, expect, it } from "vitest";
import { ageBand, hostOf, ruleTrust } from "./ruleTrust";

const NOW = new Date("2026-10-19T12:00:00Z");
const base = { conditions: "No visa needed.", sourceUrl: "https://www.mofa.go.jp/x", verified: "2026-10-19" };

describe("ageBand", () => {
  it("bands by days", () => {
    expect([0, 90, 91, 180, 181, 365, 366].map(ageBand)).toEqual(["fresh", "fresh", "recheck", "recheck", "stale", "stale", "old"]);
    expect(ageBand(null)).toBe("old");
  });
});

describe("ruleTrust", () => {
  it("fresh, sourced rule has no flags", () => {
    const t = ruleTrust(base, NOW);
    expect(t).toMatchObject({ ageDays: 0, band: "fresh", validUntil: null, expired: false, endingSoon: false, sourceHost: "mofa.go.jp", advisorySource: false, caveat: false });
  });
  it("reads a Valid until sentence and flags it as ending soon, then expired", () => {
    const c = "Visa free for 30 days. Valid until 2026-12-31. Check again.";
    expect(ruleTrust({ ...base, conditions: c }, NOW)).toMatchObject({ validUntil: "2026-12-31", endingSoon: true, expired: false });
    expect(ruleTrust({ ...base, conditions: c }, new Date("2027-01-02T12:00:00Z"))).toMatchObject({ expired: true, endingSoon: false });
  });
  it("reads a Changes on sentence", () => {
    expect(ruleTrust({ ...base, conditions: "Changes on 2027-03-01: fee rises." }, NOW).changesOn).toBe("2027-03-01");
  });
  it("marks another government's advice as advisory", () => {
    expect(ruleTrust({ ...base, sourceUrl: "https://www.gov.uk/foreign-travel-advice/france/entry-requirements" }, NOW).advisorySource).toBe(true);
    expect(ruleTrust({ ...base, sourceUrl: "https://travel.gc.ca/destinations/x" }, NOW).advisorySource).toBe(true);
    expect(ruleTrust({ ...base, sourceUrl: "https://notgov.uk.example.com/" }, NOW).advisorySource).toBe(false);
  });
  it("flags text that admits an open question", () => {
    expect(ruleTrust({ ...base, conditions: "Two sources conflict on the stay length." }, NOW).caveat).toBe(true);
    expect(ruleTrust({ ...base, conditions: "Stay up to 30 days." }, NOW).caveat).toBe(false);
  });
  it("ages from a Date as well as an ISO string", () => {
    expect(ruleTrust({ ...base, verified: new Date("2026-04-01T00:00:00Z") }, NOW).band).toBe("stale");
  });
  it("hostOf copes with junk", () => {
    expect(hostOf("not a url")).toBeNull();
    expect(hostOf(null)).toBeNull();
  });
});
