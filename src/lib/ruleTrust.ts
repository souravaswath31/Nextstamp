// What a visa answer can honestly say about itself: how recently it was checked, whether it has a
// known end date, whose page it rests on, and whether the text itself leaves something open. All
// derived from fields already on the rule, so the display can never drift from the data.
//
// Wording rule: "checked" means a page was opened and compared on that date. It does not mean the
// rule is certain. The caveat flag exists so a rule that says "confirm with the operator" or "sources
// conflict" is not dressed up as settled.

export type AgeBand = "fresh" | "recheck" | "stale" | "old";

export type RuleTrust = {
  ageDays: number | null;
  band: AgeBand;
  /** ISO date from "Valid until YYYY-MM-DD." in the text, if any. */
  validUntil: string | null;
  /** ISO date from "Changes on YYYY-MM-DD:" in the text, if any. */
  changesOn: string | null;
  /** The known end date has passed. */
  expired: boolean;
  /** A known end or change date falls within 90 days. */
  endingSoon: boolean;
  sourceHost: string | null;
  /** The source is another government's travel advice rather than the destination's own page. */
  advisorySource: boolean;
  /** The rule's own text says something is unconfirmed, conflicting or left to the operator. */
  caveat: boolean;
};

const ADVISORY_HOSTS = [
  "gov.uk",
  "travel.gc.ca",
  "smartraveller.gov.au",
  "travel.state.gov",
];

const CAVEAT = /(could not (be )?(confirm|open|verif|read)|not clearly|unclear|conflict|disagree|does not state|confirm with|check with the (airline|operator|embassy)|not confirmed|unconfirmed|disputed)/i;

const DAY = 86_400_000;

function iso(text: string, pattern: RegExp): string | null {
  const m = text.match(pattern);
  if (!m) return null;
  const d = new Date(`${m[1]}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : m[1];
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function ageBand(ageDays: number | null): AgeBand {
  if (ageDays === null) return "old";
  if (ageDays <= 90) return "fresh";
  if (ageDays <= 180) return "recheck";
  if (ageDays <= 365) return "stale";
  return "old";
}

export function ruleTrust(
  rule: { conditions: string; sourceUrl: string | null; verified: string | Date | null },
  asOf: Date = new Date()
): RuleTrust {
  const verifiedMs = rule.verified ? new Date(typeof rule.verified === "string" ? `${rule.verified}T12:00:00Z` : rule.verified).getTime() : NaN;
  const ageDays = Number.isNaN(verifiedMs) ? null : Math.max(0, Math.floor((asOf.getTime() - verifiedMs) / DAY));
  const validUntil = iso(rule.conditions, /Valid until (\d{4}-\d{2}-\d{2})\./);
  const changesOn = iso(rule.conditions, /Changes on (\d{4}-\d{2}-\d{2})[:.]/);
  const end = validUntil ?? changesOn;
  const endMs = end ? new Date(`${end}T23:59:59Z`).getTime() : null;
  const sourceHost = hostOf(rule.sourceUrl);
  return {
    ageDays,
    band: ageBand(ageDays),
    validUntil,
    changesOn,
    expired: validUntil !== null && endMs !== null && endMs < asOf.getTime(),
    endingSoon: endMs !== null && endMs >= asOf.getTime() && endMs - asOf.getTime() <= 90 * DAY,
    sourceHost,
    advisorySource: !!sourceHost && ADVISORY_HOSTS.some((h) => sourceHost === h || sourceHost.endsWith(`.${h}`)),
    caveat: CAVEAT.test(rule.conditions),
  };
}
