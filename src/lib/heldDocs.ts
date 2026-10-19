// Held-document matching. A rule can be keyed to the country that issued a visa or residence
// permit ("USA", "UK", "Japan") or to "Schengen", meaning a visa or residence permit from any
// Schengen state. A person with a German or French permit holds a "Schengen" document, so the
// match has to expand a member state into the area key, not just compare strings.
import { normalizeCountryInput } from "./countries";

export const SCHENGEN_MEMBERS = new Set([
  "Austria", "Belgium", "Bulgaria", "Croatia", "Czechia", "Denmark", "Estonia", "Finland", "France", "Germany",
  "Greece", "Hungary", "Iceland", "Italy", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", "Malta",
  "Netherlands", "Norway", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland",
]);

export const SCHENGEN_KEY = "Schengen";

/** Every rule key a document from this country can satisfy: itself, plus "Schengen" for a member state. */
export function heldDocumentKeys(country: string): string[] {
  const c = normalizeCountryInput(country);
  if (c.toLowerCase() === "schengen" || c.toLowerCase() === "schengen area") return [SCHENGEN_KEY];
  return SCHENGEN_MEMBERS.has(c) ? [c, SCHENGEN_KEY] : [c];
}

/** The set of rule keys satisfied by a list of held-document countries. */
export function heldKeySet(countries: string[]): Set<string> {
  const out = new Set<string>();
  for (const c of countries) for (const k of heldDocumentKeys(c)) out.add(k);
  return out;
}

const RANK: Record<string, number> = { "visa-free": 0, "visa-on-arrival": 1, "e-visa": 2, "advance-visa-required": 3 };

/** Easiest entry first; unknown types last. */
export function easiest<T extends { visaType: string }>(rules: T[]): T | undefined {
  return [...rules].sort((a, b) => (RANK[a.visaType] ?? 9) - (RANK[b.visaType] ?? 9))[0];
}
