import { describe, it, expect } from "vitest";
import { __testing, fcdoAlertLabel } from "./advisories";

const { stateDeptNameMatches, fcdoSlugFor } = __testing;

describe("stateDeptNameMatches", () => {
  // The State Department feed tags each item with a FIPS 10-4 / GENC code, not
  // ISO 3166-1. These are the real collisions found against the live feed when
  // this was (briefly) matched on ISO codes, and they are why matching is done
  // on names. Keep these tests: getting this wrong shows a traveller some
  // other country's safety advisory.
  it("does not confuse Morocco with Madagascar", () => {
    expect(stateDeptNameMatches("Madagascar", "Morocco")).toBe(false);
    expect(stateDeptNameMatches("Morocco", "Morocco")).toBe(true);
  });

  it("does not confuse Serbia with Russia", () => {
    expect(stateDeptNameMatches("Russia", "Serbia")).toBe(false);
    expect(stateDeptNameMatches("Serbia", "Serbia")).toBe(true);
  });

  it("resolves our short names to the feed's full ones", () => {
    expect(stateDeptNameMatches("United Arab Emirates", "UAE")).toBe(true);
    expect(stateDeptNameMatches("United States", "USA")).toBe(true);
    expect(stateDeptNameMatches("United Kingdom", "UK")).toBe(true);
  });

  it("tolerates the feed's 'Travel Advisory' suffix", () => {
    // The live feed titles Mexico's entry "Mexico Travel Advisory".
    expect(stateDeptNameMatches("Mexico Travel Advisory", "Mexico")).toBe(true);
  });

  it("matches the exact names the live feed uses for our destinations", () => {
    const liveFeedTitles: [string, string][] = [
      ["Japan", "Japan"],
      ["Thailand", "Thailand"],
      ["Vietnam", "Vietnam"],
      ["Egypt", "Egypt"],
      ["Turkey", "Turkey"],
      ["Indonesia", "Indonesia"],
      ["Armenia", "Armenia"],
      ["Georgia", "Georgia"],
      ["Costa Rica", "Costa Rica"],
      ["Colombia", "Colombia"],
      ["Peru", "Peru"],
      ["Sri Lanka", "Sri Lanka"],
      ["Maldives", "Maldives"],
      ["Philippines", "Philippines"],
    ];
    for (const [feedTitle, ours] of liveFeedTitles) {
      expect(stateDeptNameMatches(feedTitle, ours), `${feedTitle} vs ${ours}`).toBe(true);
    }
  });

  it("refuses prefix matches, which is how Niger becomes Nigeria", () => {
    expect(stateDeptNameMatches("Nigeria", "Niger")).toBe(false);
    expect(stateDeptNameMatches("Guinea-Bissau", "Guinea")).toBe(false);
    expect(stateDeptNameMatches("South Sudan", "Sudan")).toBe(false);
    expect(stateDeptNameMatches("Dominican Republic", "Dominica")).toBe(false);
  });

  it("is case- and punctuation-insensitive", () => {
    expect(stateDeptNameMatches("COSTA RICA", "Costa Rica")).toBe(true);
    expect(stateDeptNameMatches("Timor-Leste", "Timor Leste")).toBe(true);
  });
});

describe("fcdoSlugFor", () => {
  it("maps short names to gov.uk's slugs", () => {
    // All verified against the live gov.uk content API.
    expect(fcdoSlugFor("UAE")).toBe("united-arab-emirates");
    expect(fcdoSlugFor("USA")).toBe("usa");
    expect(fcdoSlugFor("Costa Rica")).toBe("costa-rica");
    expect(fcdoSlugFor("Sri Lanka")).toBe("sri-lanka");
  });

  it("hyphenates and lowercases anything without an explicit mapping", () => {
    expect(fcdoSlugFor("Japan")).toBe("japan");
    expect(fcdoSlugFor("Maldives")).toBe("maldives");
  });
});

describe("fcdoAlertLabel", () => {
  it("turns the machine values into something readable", () => {
    expect(fcdoAlertLabel("avoid_all_travel_to_whole_country")).toBe(
      "FCDO advises against all travel"
    );
    expect(fcdoAlertLabel("avoid_all_but_essential_travel_to_parts")).toContain("parts");
  });

  it("degrades gracefully on a value we haven't seen", () => {
    // FCDO can add statuses; an unknown one should read as prose, not crash.
    expect(fcdoAlertLabel("some_new_status_value")).toBe("some new status value");
  });
});
