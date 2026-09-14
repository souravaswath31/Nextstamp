import { prisma } from "./prisma";
import type { HeldDocument, User, VisaRule } from "@prisma/client";

export type VisaStatus = {
  destinationCountry: string;
  status:
    | "resident"          // user already holds valid status for this country
    | "visa-free"
    | "visa-on-arrival"
    | "e-visa"
    | "advance-visa-required"
    | "unknown";          // no rule on file yet
  viaCascade: boolean;    // true if this status depends on a held document, not the passport alone
  conditionsText?: string;
  maxStayDays?: number | null;
  feeNotes?: string | null;
  sourceUrl?: string | null;
  lastVerifiedDate?: Date | null;
  needsVerification: boolean; // true if there's no source on file, or it's aged out
};

const VERIFICATION_WINDOW_DAYS = 180;

export function isDocumentLive(doc: HeldDocument, asOf: Date) {
  return !doc.validUntil || doc.validUntil > asOf;
}

function needsVerification(rule: Pick<VisaRule, "sourceUrl" | "lastVerifiedDate">) {
  if (!rule.sourceUrl) return true;
  const ageDays =
    (Date.now() - new Date(rule.lastVerifiedDate).getTime()) / 86_400_000;
  return ageDays > VERIFICATION_WINDOW_DAYS;
}

/**
 * Resolve visa status for one destination country, for a specific user.
 * This is where the "US visa cascade" feature lives: a rule can require
 * that the user also hold a live document from a third country, and we
 * only surface the cascade-unlocked status if they actually do.
 */
export async function getVisaStatusForUser(
  user: User & { heldDocuments: HeldDocument[] },
  destinationCountry: string,
  asOf: Date = new Date()
): Promise<VisaStatus> {
  // Citizens don't need a visa for their own passport country. This matters
  // once users aren't all Sourav-with-a-US-visa — a US-passport user
  // checking a USA itinerary should get "citizen", not "unknown."
  if (user.passportCountry === destinationCountry) {
    return {
      destinationCountry,
      status: "resident",
      viaCascade: false,
      conditionsText: `You're a ${destinationCountry} citizen — no visa needed.`,
      needsVerification: false,
    };
  }

  // Already resident/visa-holder there (e.g. USA via the H1B) — no lookup needed.
  const residentDoc = user.heldDocuments.find(
    (d) => d.country === destinationCountry && isDocumentLive(d, asOf)
  );
  if (residentDoc) {
    return {
      destinationCountry,
      status: "resident",
      viaCascade: false,
      conditionsText: `You hold a valid ${destinationCountry} ${residentDoc.subtype ?? residentDoc.type}.`,
      needsVerification: false,
    };
  }

  const rules = await prisma.visaRule.findMany({
    where: { passportCountry: user.passportCountry, destinationCountry },
  });

  if (rules.length === 0) {
    return { destinationCountry, status: "unknown", viaCascade: false, needsVerification: true };
  }

  // Prefer any rule unlocked by a document the user actually holds live —
  // that's usually the better outcome (e.g. visa-free beats e-visa).
  const cascadeRule = rules.find(
    (r) =>
      r.requiresHeldDocumentCountry &&
      user.heldDocuments.some(
        (d) => d.country === r.requiresHeldDocumentCountry && isDocumentLive(d, asOf)
      )
  );

  const chosen = cascadeRule ?? rules.find((r) => !r.requiresHeldDocumentCountry) ?? rules[0];

  return {
    destinationCountry,
    status: chosen.visaType as VisaStatus["status"],
    viaCascade: Boolean(chosen.requiresHeldDocumentCountry),
    conditionsText: chosen.conditionsText,
    maxStayDays: chosen.maxStayDays,
    feeNotes: chosen.feeNotes,
    sourceUrl: chosen.sourceUrl,
    lastVerifiedDate: chosen.lastVerifiedDate,
    needsVerification: needsVerification(chosen),
  };
}

/**
 * "What if I got visa X" explorer — for every rule that cascades off a
 * given document-issuing country, show what opens up if the user held a
 * live document from that country.
 */
export async function getCascadeExplorer(passportCountry: string, documentCountry: string) {
  const rules = await prisma.visaRule.findMany({
    where: { passportCountry, requiresHeldDocumentCountry: documentCountry },
  });

  // Group by destination, keep the best (visa-free > visa-on-arrival > e-visa) row.
  const rank: Record<string, number> = {
    "visa-free": 0,
    "visa-on-arrival": 1,
    "e-visa": 2,
    "advance-visa-required": 3,
  };

  const byDestination = new Map<string, (typeof rules)[number]>();
  for (const r of rules) {
    const existing = byDestination.get(r.destinationCountry);
    if (!existing || rank[r.visaType] < rank[existing.visaType]) {
      byDestination.set(r.destinationCountry, r);
    }
  }

  return Array.from(byDestination.values()).sort(
    (a, b) => rank[a.visaType] - rank[b.visaType]
  );
}

const EASY_ACCESS_STATUSES = new Set<VisaStatus["status"]>([
  "resident",
  "visa-free",
  "visa-on-arrival",
]);

/**
 * All destinations this specific user (their passport + whatever documents
 * they hold) can currently enter without arranging a visa in advance —
 * resident status, visa-free, and visa-on-arrival. e-visa and
 * advance-visa-required are excluded since both require action before
 * travel, not just at the border.
 *
 * Only covers destinations this user actually has a rule or held document
 * for, so it's exactly as complete as the visa engine's current coverage —
 * not every country in the world, just every one NextStamp has researched
 * for this passport (plus anywhere a held document already grants status).
 */
export async function getEasyAccessDestinations(
  user: User & { heldDocuments: HeldDocument[] },
  asOf: Date = new Date()
): Promise<VisaStatus[]> {
  const ruleDestinations = await prisma.visaRule.findMany({
    where: { passportCountry: user.passportCountry },
    distinct: ["destinationCountry"],
    select: { destinationCountry: true },
  });

  const destinations = new Set(ruleDestinations.map((d) => d.destinationCountry));
  for (const doc of user.heldDocuments) {
    if (isDocumentLive(doc, asOf)) destinations.add(doc.country);
  }
  destinations.delete(user.passportCountry);

  const statuses = await Promise.all(
    Array.from(destinations).map((country) => getVisaStatusForUser(user, country, asOf))
  );

  return statuses
    .filter((s) => EASY_ACCESS_STATUSES.has(s.status))
    .sort((a, b) => a.destinationCountry.localeCompare(b.destinationCountry));
}
