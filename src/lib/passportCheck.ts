import { normalizeCountryInput } from "./countries";
import { easiest, heldKeySet } from "./heldDocs";

/**
 * The public passport checker's resolution logic, kept pure (no Prisma) so the
 * same function runs in the browser — the landing-page checker answers instantly
 * without a network call — and in tests.
 *
 * Selection mirrors getVisaStatusForUser in visa.ts, on purpose: a rule that
 * needs a held document from another country wins when the visitor says they
 * hold one, otherwise the unconditional rule, otherwise whatever is first. If
 * you change one, change the other; passportCheck.test.ts pins the cases.
 */

export type PublicRule = {
  passport: string;
  destination: string;
  visaType: "visa-free" | "visa-on-arrival" | "e-visa" | "advance-visa-required";
  /** Country whose live visa/residence unlocks this rule, or null. */
  requiresDocCountry: string | null;
  conditions: string;
  maxStayDays: number | null;
  feeNotes: string | null;
  sourceUrl: string | null;
  /** ISO date (YYYY-MM-DD) the rule was last checked against its source. */
  verified: string;
};

export type CheckResult =
  | { kind: "unsupported-passport"; typed: string }
  | { kind: "unknown-destination"; typed: string }
  | { kind: "citizen"; country: string }
  | { kind: "no-rule"; passport: string; destination: string }
  | {
      kind: "rule";
      rule: PublicRule;
      /** True when the answer depends on a held document, not the passport alone. */
      viaDocument: string | null;
      /** True when the rule is older than the verification window. */
      stale: boolean;
    };

export const STALE_AFTER_DAYS = 180;

/** Case-insensitive match against a known list, falling back to alias normalisation. */
export function matchCountry(input: string, known: string[]): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const direct = known.find((k) => k.toLowerCase() === trimmed.toLowerCase());
  if (direct) return direct;
  const normalized = normalizeCountryInput(trimmed);
  return known.find((k) => k.toLowerCase() === normalized.toLowerCase()) ?? null;
}

export function resolveCheck(
  rules: PublicRule[],
  supportedPassports: string[],
  passportInput: string,
  destinationInput: string,
  heldDocumentCountries: string[] = [],
  asOf: Date = new Date()
): CheckResult {
  const passport = matchCountry(passportInput, supportedPassports);
  if (!passport) return { kind: "unsupported-passport", typed: passportInput.trim() };

  const destinations = Array.from(new Set(rules.map((r) => r.destination)));
  // A passport holder's own country is a valid destination even with no rule.
  const destination = matchCountry(destinationInput, [...destinations, ...supportedPassports]);
  if (!destination) return { kind: "unknown-destination", typed: destinationInput.trim() };

  if (destination === passport) return { kind: "citizen", country: passport };

  const forPair = rules.filter((r) => r.passport === passport && r.destination === destination);
  if (forPair.length === 0) return { kind: "no-rule", passport, destination };

  const held = heldKeySet(heldDocumentCountries);
  const base = forPair.find((r) => !r.requiresDocCountry);
  const viaCandidates = forPair.filter((r) => r.requiresDocCountry && held.has(r.requiresDocCountry));
  const chosen = easiest([...(base ? [base] : []), ...viaCandidates]) ?? forPair[0];
  const viaDoc = chosen.requiresDocCountry ? chosen : undefined;

  const ageDays = (asOf.getTime() - new Date(chosen.verified).getTime()) / 86_400_000;
  return {
    kind: "rule",
    rule: chosen,
    viaDocument: viaDoc ? viaDoc.requiresDocCountry : null,
    stale: ageDays > STALE_AFTER_DAYS,
  };
}

/** Countries whose visa/residence changes some rule for this passport. */
export function cascadeDocumentsFor(rules: PublicRule[], passport: string): string[] {
  return Array.from(
    new Set(
      rules
        .filter((r) => r.passport === passport && r.requiresDocCountry)
        .map((r) => r.requiresDocCountry as string)
    )
  ).sort();
}

export type CascadeRow = {
  destination: string;
  before: PublicRule | null;
  after: PublicRule;
  changed: boolean;
};

/**
 * Every destination this passport has a rule for, resolved with and without a
 * document from `docCountry`. `changed` marks the ones the document actually
 * moves — the whole point of the cascade demo.
 */
export function cascadeComparison(
  rules: PublicRule[],
  passport: string,
  docCountry: string
): CascadeRow[] {
  const destinations = Array.from(
    new Set(rules.filter((r) => r.passport === passport).map((r) => r.destination))
  ).sort();
  const rows: CascadeRow[] = [];
  for (const destination of destinations) {
    const forPair = rules.filter((r) => r.passport === passport && r.destination === destination);
    const plain = forPair.find((r) => !r.requiresDocCountry) ?? null;
    const withDoc = forPair.find((r) => r.requiresDocCountry === docCountry) ?? plain ?? forPair[0];
    rows.push({
      destination,
      before: plain,
      after: withDoc,
      changed: withDoc !== plain,
    });
  }
  return rows;
}

export const VISA_TYPE_LABEL: Record<PublicRule["visaType"], string> = {
  "visa-free": "Visa free",
  "visa-on-arrival": "Visa on arrival",
  "e-visa": "e-Visa",
  "advance-visa-required": "Visa required in advance",
};

/** "6 September 2026" from an ISO date. Lives here, not in a client component, so server pages can call it. */
export function formatVerified(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
