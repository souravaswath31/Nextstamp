// Helpers for the public visa pages: /visa, /visa/from/<passport>, /visa/<passport>-to-<destination>
// and /visa/<passport>-with-<document>. All pure, so the URL rules and the one-sentence answers are tested.
import { slugify } from "./slug";
import { easiest } from "./heldDocs";
import { ruleTrust } from "./ruleTrust";
import type { PublicRule } from "./passportCheck";

export const docLabel = (c: string) => (c === "USA" ? "US" : c);
export const pairSlug = (passport: string, destination: string) => `${slugify(passport)}-to-${slugify(destination)}`;
export const cascadeSlug = (passport: string, doc: string) => `${slugify(passport)}-with-${slugify(doc)}`;

export type Parsed =
  | { kind: "pair"; passport: string; destination: string }
  | { kind: "cascade"; passport: string; doc: string }
  | null;

export function parseVisaSlug(slug: string, rules: PublicRule[]): Parsed {
  const passports = new Map<string, string>();
  const destinations = new Map<string, string>();
  const docs = new Map<string, string>();
  for (const r of rules) {
    passports.set(slugify(r.passport), r.passport);
    destinations.set(slugify(r.destination), r.destination);
    if (r.requiresDocCountry) docs.set(slugify(r.requiresDocCountry), r.requiresDocCountry);
  }
  const to = slug.indexOf("-to-");
  if (to > 0) {
    const passport = passports.get(slug.slice(0, to));
    const destination = destinations.get(slug.slice(to + 4));
    return passport && destination && passport !== destination ? { kind: "pair", passport, destination } : null;
  }
  const w = slug.indexOf("-with-");
  if (w > 0) {
    const passport = passports.get(slug.slice(0, w));
    const doc = docs.get(slug.slice(w + 6));
    return passport && doc ? { kind: "cascade", passport, doc } : null;
  }
  return null;
}

/** The first sentence of a pair page: the answer, in plain words. */
export function answerSentence(rule: PublicRule): string {
  const who = `${rule.passport} passport holders`;
  const stay = rule.maxStayDays ? ` for up to ${rule.maxStayDays} days` : "";
  switch (rule.visaType) {
    case "visa-free":
      return `${who} can enter ${rule.destination} without a visa${stay}.`;
    case "visa-on-arrival":
      return `${who} can get a visa on arrival in ${rule.destination}${stay}.`;
    case "e-visa":
      return `${who} need an e-visa or online authorisation for ${rule.destination}${stay}, applied for before travel.`;
    default:
      return `${who} must get a visa for ${rule.destination} in advance${stay}.`;
  }
}

/** The popular destinations whose pair pages are put in front of search engines first. Others stay reachable
 *  from the hubs but are marked noindex until the staged set has been seen to index (see docs/LAUNCH_PLAN.md). */
export const STAGED_DESTINATIONS = new Set([
  "Thailand", "Japan", "UAE", "Turkey", "Mexico", "Vietnam", "Indonesia", "South Korea", "France", "Italy", "Spain",
  "Germany", "Portugal", "Greece", "Egypt", "Morocco", "Malaysia", "Sri Lanka", "Philippines", "Costa Rica", "USA",
  "UK", "Canada", "Australia",
]);

export function baseRule(rules: PublicRule[], passport: string, destination: string): PublicRule | undefined {
  return rules.find((r) => r.passport === passport && r.destination === destination && !r.requiresDocCountry);
}

export function pairRules(rules: PublicRule[], passport: string, destination: string): PublicRule[] {
  return rules.filter((r) => r.passport === passport && r.destination === destination);
}

/** A pair page is indexable only if it is in the staged set, has a base rule with a source, is not out of date and has not ended. */
export function isIndexablePair(rules: PublicRule[], passport: string, destination: string, asOf = new Date()): boolean {
  if (!STAGED_DESTINATIONS.has(destination)) return false;
  const b = baseRule(rules, passport, destination);
  if (!b || !b.sourceUrl) return false;
  const t = ruleTrust({ conditions: b.conditions, sourceUrl: b.sourceUrl, verified: b.verified }, asOf);
  return t.band !== "old" && !t.expired;
}

export type Improvement = { destination: string; base: PublicRule | null; withDoc: PublicRule };

/** Destinations where holding this document gives an easier entry than the passport alone. */
export function cascadeImprovements(rules: PublicRule[], passport: string, doc: string): Improvement[] {
  const rank: Record<string, number> = { "visa-free": 0, "visa-on-arrival": 1, "e-visa": 2, "advance-visa-required": 3 };
  const out: Improvement[] = [];
  const dests = new Set(rules.filter((r) => r.passport === passport && r.requiresDocCountry === doc).map((r) => r.destination));
  for (const destination of Array.from(dests).sort()) {
    const base = baseRule(rules, passport, destination) ?? null;
    const via = rules.filter((r) => r.passport === passport && r.destination === destination && r.requiresDocCountry === doc);
    const best = easiest(via);
    if (!best) continue;
    if (!base || rank[best.visaType] < rank[base.visaType] || (best.visaType === base.visaType && (best.maxStayDays ?? 0) > (base.maxStayDays ?? 0))) {
      out.push({ destination, base, withDoc: best });
    }
  }
  return out;
}

/** Document keys that change at least `min` destinations for a passport. These get their own page. */
export function cascadeDocuments(rules: PublicRule[], passport: string, min = 3): string[] {
  const docs = new Set(rules.filter((r) => r.passport === passport && r.requiresDocCountry).map((r) => r.requiresDocCountry as string));
  return Array.from(docs).filter((d) => cascadeImprovements(rules, passport, d).length >= min).sort();
}

export const passportsIn = (rules: PublicRule[]) => Array.from(new Set(rules.map((r) => r.passport))).sort();
