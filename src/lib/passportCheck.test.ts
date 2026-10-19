import { describe, it, expect } from "vitest";
import {
  resolveCheck,
  cascadeComparison,
  cascadeDocumentsFor,
  matchCountry,
  type PublicRule,
} from "./passportCheck";

const rule = (o: Partial<PublicRule>): PublicRule => ({
  passport: "India",
  destination: "UAE",
  visaType: "advance-visa-required",
  requiresDocCountry: null,
  conditions: "c",
  maxStayDays: null,
  feeNotes: null,
  sourceUrl: "https://example.gov",
  verified: "2026-09-06",
  ...o,
});

// The same shape as the real data for the five cases the brief names.
const RULES: PublicRule[] = [
  rule({}),
  rule({ visaType: "visa-on-arrival", requiresDocCountry: "USA", maxStayDays: 14 }),
  rule({ passport: "USA", visaType: "visa-free", maxStayDays: 90, verified: "2026-09-14" }),
  rule({ destination: "Japan", visaType: "e-visa" }),
];
const PASSPORTS = ["India", "USA"];
const ASOF = new Date("2026-10-04T00:00:00Z");

describe("resolveCheck — the cases that define the product", () => {
  it("India with no US visa to UAE needs a visa in advance", () => {
    const r = resolveCheck(RULES, PASSPORTS, "India", "UAE", [], ASOF);
    expect(r.kind).toBe("rule");
    if (r.kind === "rule") {
      expect(r.rule.visaType).toBe("advance-visa-required");
      expect(r.viaDocument).toBeNull();
    }
  });

  it("India holding a US visa gets visa on arrival, flagged as via the US visa", () => {
    const r = resolveCheck(RULES, PASSPORTS, "India", "UAE", ["USA"], ASOF);
    expect(r.kind).toBe("rule");
    if (r.kind === "rule") {
      expect(r.rule.visaType).toBe("visa-on-arrival");
      expect(r.viaDocument).toBe("USA");
      expect(r.rule.maxStayDays).toBe(14);
    }
  });

  it("USA passport to UAE is visa free", () => {
    const r = resolveCheck(RULES, PASSPORTS, "USA", "UAE", [], ASOF);
    expect(r.kind === "rule" && r.rule.visaType).toBe("visa-free");
  });

  it("normalises 'usa', 'United States' and 'uae'", () => {
    for (const p of ["usa", "United States", "U.S.A."]) {
      const r = resolveCheck(RULES, PASSPORTS, p, "uae", [], ASOF);
      expect(r.kind, p).toBe("rule");
    }
  });

  it("an unsupported passport says so instead of guessing", () => {
    const r = resolveCheck(RULES, PASSPORTS, "Narnia", "UAE", [], ASOF);
    expect(r).toEqual({ kind: "unsupported-passport", typed: "Narnia" });
  });

  it("a holder visiting their own country is told they are a citizen", () => {
    expect(resolveCheck(RULES, PASSPORTS, "USA", "USA", [], ASOF)).toEqual({
      kind: "citizen",
      country: "USA",
    });
  });

  it("a pair with no rule is reported as unresearched, not as 'no visa needed'", () => {
    const r = resolveCheck(RULES, PASSPORTS, "USA", "Japan", [], ASOF);
    expect(r.kind).toBe("no-rule");
  });

  it("flags a rule older than the verification window", () => {
    const r = resolveCheck(RULES, PASSPORTS, "India", "UAE", [], new Date("2027-06-01T00:00:00Z"));
    expect(r.kind === "rule" && r.stale).toBe(true);
    const fresh = resolveCheck(RULES, PASSPORTS, "India", "UAE", [], ASOF);
    expect(fresh.kind === "rule" && fresh.stale).toBe(false);
  });
});

describe("cascade helpers", () => {
  it("lists which documents change anything for a passport", () => {
    expect(cascadeDocumentsFor(RULES, "India")).toEqual(["USA"]);
    expect(cascadeDocumentsFor(RULES, "USA")).toEqual([]);
  });

  it("marks only the destinations the document actually moves", () => {
    const rows = cascadeComparison(RULES, "India", "USA");
    const uae = rows.find((r) => r.destination === "UAE")!;
    const japan = rows.find((r) => r.destination === "Japan")!;
    expect(uae.changed).toBe(true);
    expect(uae.before?.visaType).toBe("advance-visa-required");
    expect(uae.after.visaType).toBe("visa-on-arrival");
    expect(japan.changed).toBe(false);
  });
});

describe("matchCountry", () => {
  it("is case-insensitive and rejects blanks", () => {
    expect(matchCountry("INDIA", PASSPORTS)).toBe("India");
    expect(matchCountry("   ", PASSPORTS)).toBeNull();
  });
});

describe("held documents from a Schengen state and multiple documents", () => {
  const turkey = [
    rule({ destination: "Turkey", visaType: "advance-visa-required" }),
    rule({ destination: "Turkey", visaType: "e-visa", requiresDocCountry: "Schengen" }),
    rule({ destination: "Turkey", visaType: "visa-free", requiresDocCountry: "UK" }),
  ];
  it("a German permit satisfies a Schengen rule", () => {
    const r = resolveCheck(turkey, ["India"], "India", "Turkey", ["Germany"]);
    expect(r.kind === "rule" && r.rule.visaType).toBe("e-visa");
    expect(r.kind === "rule" && r.viaDocument).toBe("Schengen");
  });
  it("picks the easiest of several qualifying documents", () => {
    const r = resolveCheck(turkey, ["India"], "India", "Turkey", ["Germany", "UK"]);
    expect(r.kind === "rule" && r.rule.visaType).toBe("visa-free");
    expect(r.kind === "rule" && r.viaDocument).toBe("UK");
  });
  it("no document means the passport-only rule and no 'via' label", () => {
    const r = resolveCheck(turkey, ["India"], "India", "Turkey", []);
    expect(r.kind === "rule" && r.rule.visaType).toBe("advance-visa-required");
    expect(r.kind === "rule" && r.viaDocument).toBeNull();
  });
});
