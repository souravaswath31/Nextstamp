import { describe, expect, it } from "vitest";
import { answerSentence, cascadeDocuments, cascadeImprovements, cascadeSlug, isIndexablePair, pairSlug, parseVisaSlug } from "./visaPages";
import type { PublicRule } from "./passportCheck";

const r = (o: Partial<PublicRule>): PublicRule => ({
  passport: "India", destination: "Thailand", visaType: "e-visa", requiresDocCountry: null, conditions: "c",
  maxStayDays: 30, feeNotes: null, sourceUrl: "https://mfa.go.th/x", verified: "2026-10-19", ...o,
});
const RULES: PublicRule[] = [
  r({}),
  r({ destination: "Turkey", visaType: "advance-visa-required", maxStayDays: null }),
  r({ destination: "Turkey", visaType: "e-visa", requiresDocCountry: "USA" }),
  r({ destination: "Oman", visaType: "advance-visa-required" }),
  r({ destination: "Oman", visaType: "visa-free", requiresDocCountry: "USA", maxStayDays: 14 }),
  r({ destination: "Mexico", visaType: "advance-visa-required" }),
  r({ destination: "Mexico", visaType: "visa-free", requiresDocCountry: "USA", maxStayDays: 180 }),
  r({ passport: "South Korea", destination: "Japan", visaType: "visa-free" }),
];

describe("slugs", () => {
  it("round-trip", () => {
    expect(pairSlug("India", "Sri Lanka")).toBe("india-to-sri-lanka");
    expect(cascadeSlug("India", "USA")).toBe("india-with-usa");
    expect(parseVisaSlug("india-to-thailand", RULES)).toEqual({ kind: "pair", passport: "India", destination: "Thailand" });
    expect(parseVisaSlug("india-with-usa", RULES)).toEqual({ kind: "cascade", passport: "India", doc: "USA" });
    expect(parseVisaSlug("south-korea-to-japan", RULES)).toEqual({ kind: "pair", passport: "South Korea", destination: "Japan" });
  });
  it("rejects unknown, self-pairs and junk", () => {
    expect(parseVisaSlug("india-to-narnia", RULES)).toBeNull();
    expect(parseVisaSlug("india-to-india", RULES)).toBeNull();
    expect(parseVisaSlug("whatever", RULES)).toBeNull();
    expect(parseVisaSlug("india-with-narnia", RULES)).toBeNull();
  });
});

describe("answerSentence", () => {
  it("says it plainly for each type", () => {
    expect(answerSentence(r({ visaType: "visa-free", maxStayDays: 90 }))).toBe("India passport holders can enter Thailand without a visa for up to 90 days.");
    expect(answerSentence(r({ visaType: "advance-visa-required", maxStayDays: null }))).toBe("India passport holders must get a visa for Thailand in advance.");
    expect(answerSentence(r({ visaType: "visa-on-arrival" }))).toContain("visa on arrival");
  });
});

describe("indexing", () => {
  it("indexes staged, sourced, current pairs only", () => {
    const now = new Date("2026-10-20T00:00:00Z");
    expect(isIndexablePair(RULES, "India", "Thailand", now)).toBe(true);
    expect(isIndexablePair(RULES, "India", "Oman", now)).toBe(false); // not a staged destination
    expect(isIndexablePair(RULES, "India", "Narnia", now)).toBe(false);
    expect(isIndexablePair(RULES, "India", "Thailand", new Date("2028-01-01T00:00:00Z"))).toBe(false); // out of date
    expect(isIndexablePair([r({ conditions: "Valid until 2026-12-31." })], "India", "Thailand", new Date("2027-02-01T00:00:00Z"))).toBe(false); // ended
    expect(isIndexablePair([r({ sourceUrl: null })], "India", "Thailand", now)).toBe(false);
  });
});

describe("cascade pages", () => {
  it("lists only destinations the document actually improves", () => {
    const imp = cascadeImprovements(RULES, "India", "USA");
    expect(imp.map((i) => i.destination)).toEqual(["Mexico", "Oman", "Turkey"]);
    expect(imp.find((i) => i.destination === "Mexico")?.withDoc.visaType).toBe("visa-free");
  });
  it("gives a page to documents that open at least 3 destinations", () => {
    expect(cascadeDocuments(RULES, "India")).toEqual(["USA"]);
    expect(cascadeDocuments(RULES, "India", 4)).toEqual([]);
  });
});
