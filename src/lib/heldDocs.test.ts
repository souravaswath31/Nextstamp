import { describe, expect, it } from "vitest";
import { easiest, heldDocumentKeys, heldKeySet } from "./heldDocs";

describe("heldDocumentKeys", () => {
  it("expands a Schengen member to the area key", () => {
    expect(heldDocumentKeys("Germany")).toEqual(["Germany", "Schengen"]);
    expect(heldDocumentKeys("france")).toEqual(["France", "Schengen"]);
  });
  it("accepts Schengen itself", () => {
    expect(heldDocumentKeys("Schengen")).toEqual(["Schengen"]);
    expect(heldDocumentKeys("schengen area")).toEqual(["Schengen"]);
  });
  it("leaves other countries alone and applies aliases", () => {
    expect(heldDocumentKeys("united states")).toEqual(["USA"]);
    expect(heldDocumentKeys("Ireland")).toEqual(["Ireland"]);
    expect(heldDocumentKeys("Cyprus")).toEqual(["Cyprus"]);
  });
});

describe("heldKeySet / easiest", () => {
  it("unions several documents", () => {
    const s = heldKeySet(["USA", "Italy"]);
    expect([...s].sort()).toEqual(["Italy", "Schengen", "USA"]);
  });
  it("prefers the easiest entry", () => {
    expect(easiest([{ visaType: "e-visa" }, { visaType: "visa-free" }, { visaType: "advance-visa-required" }])?.visaType).toBe("visa-free");
    expect(easiest([])).toBeUndefined();
  });
});
