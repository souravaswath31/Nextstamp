import { describe, it, expect } from "vitest";
import { normalizeCountryInput } from "./countries";

describe("normalizeCountryInput", () => {
  it("normalizes common USA aliases to the canonical form", () => {
    expect(normalizeCountryInput("usa")).toBe("USA");
    expect(normalizeCountryInput("US")).toBe("USA");
    expect(normalizeCountryInput("United States")).toBe("USA");
    expect(normalizeCountryInput("united states of america")).toBe("USA");
  });

  it("normalizes UK and UAE aliases", () => {
    expect(normalizeCountryInput("uk")).toBe("UK");
    expect(normalizeCountryInput("United Kingdom")).toBe("UK");
    expect(normalizeCountryInput("uae")).toBe("UAE");
    expect(normalizeCountryInput("United Arab Emirates")).toBe("UAE");
  });

  it("title-cases an unrecognized country so casing variants converge", () => {
    expect(normalizeCountryInput("india")).toBe("India");
    expect(normalizeCountryInput("INDIA")).toBe("India");
    expect(normalizeCountryInput("India")).toBe("India");
  });

  it("title-cases each word of a multi-word country name", () => {
    expect(normalizeCountryInput("costa rica")).toBe("Costa Rica");
    expect(normalizeCountryInput("SRI LANKA")).toBe("Sri Lanka");
  });

  it("collapses extra internal whitespace", () => {
    expect(normalizeCountryInput("costa   rica")).toBe("Costa Rica");
  });

  it("returns an empty string unchanged", () => {
    expect(normalizeCountryInput("")).toBe("");
    expect(normalizeCountryInput("   ")).toBe("");
  });
});
