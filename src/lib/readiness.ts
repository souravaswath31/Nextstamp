import type { HeldDocument, User, UserTrip } from "@prisma/client";
import { getVisaStatusForUser, isDocumentLive, type VisaStatus } from "./visa";
import { getCountryFact, type CountryFactFull } from "./countryFacts";

/**
 * Entry readiness — the layer on top of "do you need a visa".
 *
 * The visa engine answers a question about a passport. This answers a
 * question about a *trip*: given these dates, this destination, and the
 * documents you actually hold, is there anything that will stop you at the
 * gate? That needs UserTrip.startDate/.endDate/.destinationCountry and
 * User.passportExpiry, which is why those three fields had to exist first.
 *
 * Deliberate omission: we do not state visa processing lead times. Nobody
 * has researched a per-destination lead time into CountryFact yet, and
 * inventing "allow 2-3 weeks" would be exactly the kind of plausible
 * fabrication this project refuses everywhere else (see CLAUDE.md). Instead
 * an advance-visa check reports how many days are left before departure and
 * links to the official application source, letting the issuing authority's
 * own stated times be the answer.
 */

export type CheckState = "ok" | "warn" | "blocked" | "unknown";

export type ReadinessCheck = {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
  /** What to actually do about it, when there is something to do. */
  action?: string;
  sourceUrl?: string | null;
};

export type ReadinessReport = {
  destinationCountry: string | null;
  startDate: Date | null;
  endDate: Date | null;
  tripNights: number | null;
  daysUntilDeparture: number | null;
  visaStatus: VisaStatus | null;
  countryFact: CountryFactFull | null;
  checks: ReadinessCheck[];
  /** Worst state across all checks — what the summary badge shows. */
  overall: CheckState;
};

const MS_PER_DAY = 86_400_000;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfUtcDay(b).getTime() - startOfUtcDay(a).getTime()) / MS_PER_DAY);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Add months the way a border officer counts them: the same day-of-month N
 * months on, clamped to the end of a shorter month. Avoids the
 * 30-days-is-a-month drift that would make a borderline passport read as
 * fine when it isn't.
 *
 * Exported for tests — this is the arithmetic the whole feature turns on.
 */
export function addMonths(d: Date, months: number): Date {
  const result = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate())
  );
  if (result.getUTCDate() !== d.getUTCDate()) {
    // Rolled into the following month (e.g. Aug 31 + 6 → Mar 3); pull back
    // to the last day of the intended month.
    result.setUTCDate(0);
  }
  return result;
}

export type ValidityBasis = "entry" | "exit" | "duration-of-stay" | "none";

export type ValidityVerdict = {
  /** The date the passport must remain valid through. */
  requiredUntil: Date;
  /** Days of slack. Negative means the passport falls short. */
  marginDays: number;
  state: Extract<CheckState, "ok" | "warn" | "blocked">;
};

/**
 * Does this passport satisfy this destination's validity rule for these dates?
 *
 * Pulled out as a pure function because it's the single calculation in the app
 * where being wrong has a real cost — someone books a non-refundable trip they
 * can't take, or cancels one they could have. Tested directly in
 * readiness.test.ts rather than only through a database round trip.
 *
 * A margin under 30 days is reported as a warning rather than a pass: a date
 * change, a delayed return, or an officer measuring from a slightly different
 * day all eat into it, and "technically clears it by four days" is not
 * something to book against.
 */
export function passportValidityVerdict(
  passportExpiry: Date,
  entryDate: Date,
  exitDate: Date | null,
  monthsRequired: number,
  basis: ValidityBasis,
  thinMarginDays = 30
): ValidityVerdict {
  const measureFrom = basis === "exit" && exitDate ? exitDate : entryDate;
  const requiredUntil =
    basis === "duration-of-stay" || basis === "none"
      ? (exitDate ?? entryDate)
      : addMonths(measureFrom, monthsRequired);

  const marginDays = daysBetween(requiredUntil, passportExpiry);
  const state = marginDays < 0 ? "blocked" : marginDays < thinMarginDays ? "warn" : "ok";
  return { requiredUntil, marginDays, state };
}

const STATE_RANK: Record<CheckState, number> = { ok: 0, unknown: 1, warn: 2, blocked: 3 };

function worst(states: CheckState[]): CheckState {
  return states.reduce<CheckState>(
    (acc, s) => (STATE_RANK[s] > STATE_RANK[acc] ? s : acc),
    "ok"
  );
}

export async function buildReadinessReport(
  user: User & { heldDocuments: HeldDocument[] },
  trip: Pick<UserTrip, "startDate" | "endDate" | "destinationCountry">,
  asOf: Date = new Date()
): Promise<ReadinessReport> {
  const destinationCountry = trip.destinationCountry ?? null;
  const startDate = trip.startDate ?? null;
  const endDate = trip.endDate ?? null;

  const tripNights = startDate && endDate ? Math.max(0, daysBetween(startDate, endDate)) : null;
  const daysUntilDeparture = startDate ? daysBetween(asOf, startDate) : null;

  const [visaStatus, countryFact] = await Promise.all([
    destinationCountry
      ? getVisaStatusForUser(user, destinationCountry, startDate ?? asOf)
      : Promise.resolve(null),
    destinationCountry ? getCountryFact(destinationCountry) : Promise.resolve(null),
  ]);

  const checks: ReadinessCheck[] = [];

  // --- The two prerequisites. Everything below reads better when these pass,
  // --- and several checks can't run at all without them.
  if (!destinationCountry) {
    checks.push({
      id: "destination",
      label: "Destination",
      state: "unknown",
      detail: "This trip doesn't have a destination country set yet.",
      action: "Set one and every check below starts working.",
    });
  }
  if (!startDate) {
    checks.push({
      id: "dates",
      label: "Travel dates",
      state: "unknown",
      detail: "This trip doesn't have travel dates yet.",
      action: "Add your dates — passport validity and entry rules are both measured against them.",
    });
  }

  // --- Passport expiry against the destination's own stated rule. This is
  // --- the check the whole feature exists for.
  const entryDate = startDate;
  if (!user.passportExpiry) {
    checks.push({
      id: "passport-expiry",
      label: "Passport validity",
      state: "unknown",
      detail: "We don't have your passport's expiry date.",
      action: "Add it on your profile — it's the most common reason people get turned away at check-in.",
    });
  } else if (!entryDate) {
    checks.push({
      id: "passport-expiry",
      label: "Passport validity",
      state: "unknown",
      detail: `Your passport expires ${formatDate(user.passportExpiry)}. Without travel dates we can't check it against this destination's rule.`,
    });
  } else {
    const monthsRequired = countryFact?.passportValidityMonthsBeyondEntry ?? 0;
    const basis = (countryFact?.passportValidityBasis ?? "none") as ValidityBasis;
    const { requiredUntil, marginDays, state } = passportValidityVerdict(
      user.passportExpiry,
      entryDate,
      endDate,
      monthsRequired,
      basis
    );
    const ruleText = countryFact?.passportValidityRule
      ? countryFact.passportValidityRule
      : monthsRequired > 0
        ? `${destinationCountry} requires ${monthsRequired} months' validity beyond ${basis === "exit" ? "departure" : "entry"}.`
        : "No minimum validity beyond the trip itself is on file for this destination.";

    if (state === "blocked") {
      checks.push({
        id: "passport-expiry",
        label: "Passport validity",
        state: "blocked",
        detail: `Your passport expires ${formatDate(user.passportExpiry)}, which is ${Math.abs(marginDays)} day${Math.abs(marginDays) === 1 ? "" : "s"} short. ${ruleText}`,
        action: `You need a passport valid through at least ${formatDate(requiredUntil)}. Renew before booking anything non-refundable.`,
        sourceUrl: countryFact?.passportSourceUrl ?? null,
      });
    } else if (state === "warn") {
      checks.push({
        id: "passport-expiry",
        label: "Passport validity",
        state: "warn",
        detail: `Your passport clears this destination's rule by only ${marginDays} day${marginDays === 1 ? "" : "s"} (expires ${formatDate(user.passportExpiry)}). ${ruleText}`,
        action: "That's thin enough that a date change or a delay could break it. Consider renewing.",
        sourceUrl: countryFact?.passportSourceUrl ?? null,
      });
    } else {
      checks.push({
        id: "passport-expiry",
        label: "Passport validity",
        state: "ok",
        detail: `Your passport is valid through ${formatDate(user.passportExpiry)} — comfortably past what ${destinationCountry} requires. ${ruleText}`,
        sourceUrl: countryFact?.passportSourceUrl ?? null,
      });
    }
  }

  // --- The visa answer, turned into a deadline rather than a status.
  if (visaStatus && destinationCountry) {
    const needsAdvanceAction =
      visaStatus.status === "e-visa" || visaStatus.status === "advance-visa-required";

    if (visaStatus.status === "unknown") {
      checks.push({
        id: "visa",
        label: "Visa",
        state: "unknown",
        detail: `We don't have a researched rule for a ${user.passportCountry} passport entering ${destinationCountry} yet.`,
        action: "Check the destination's own immigration authority before you book.",
      });
    } else if (needsAdvanceAction) {
      const urgency =
        daysUntilDeparture === null
          ? "warn"
          : daysUntilDeparture < 0
            ? "warn"
            : daysUntilDeparture <= 30
              ? "blocked"
              : "warn";
      const timing =
        daysUntilDeparture === null
          ? "Set your travel dates and we'll count down to departure."
          : daysUntilDeparture < 0
            ? "This trip's start date has already passed."
            : `You have ${daysUntilDeparture} day${daysUntilDeparture === 1 ? "" : "s"} until departure.`;
      checks.push({
        id: "visa",
        label: visaStatus.status === "e-visa" ? "E-visa required" : "Visa required in advance",
        state: urgency as CheckState,
        detail: `${visaStatus.conditionsText ?? "This destination requires a visa arranged before you travel."} ${timing}`,
        action:
          "Start the application at the official source below. Processing times are set by the issuing authority — check theirs, we don't estimate it.",
        sourceUrl: visaStatus.sourceUrl ?? null,
      });
    } else {
      checks.push({
        id: "visa",
        label: visaStatus.status === "resident" ? "Entry status" : "Visa",
        state: "ok",
        detail:
          visaStatus.conditionsText ??
          `Nothing to arrange in advance for a ${user.passportCountry} passport.`,
        sourceUrl: visaStatus.sourceUrl ?? null,
      });
    }

    // Staleness is surfaced, not hidden — same principle as VisaBadge.
    if (visaStatus.needsVerification && visaStatus.status !== "unknown") {
      checks.push({
        id: "visa-freshness",
        label: "Rule freshness",
        state: "warn",
        detail: visaStatus.lastVerifiedDate
          ? `Our ${destinationCountry} rule was last verified ${formatDate(new Date(visaStatus.lastVerifiedDate))}. Entry policies change without much notice.`
          : `Our ${destinationCountry} rule has no source on file.`,
        action: "Confirm against the official source before you rely on it.",
        sourceUrl: visaStatus.sourceUrl ?? null,
      });
    }
  }

  // --- A cascade-derived entry right is only as good as the document behind
  // --- it, and the document has to still be valid *on the travel dates*,
  // --- not merely today. This is the check nobody does by hand.
  if (visaStatus?.viaCascade && entryDate) {
    const supporting = user.heldDocuments.filter((d) => isDocumentLive(d, asOf));
    const expiringBeforeTrip = supporting.filter(
      (d) => d.validUntil && endDate && d.validUntil < endDate
    );
    if (expiringBeforeTrip.length > 0) {
      const d = expiringBeforeTrip[0];
      checks.push({
        id: "cascade-document",
        label: "Supporting document",
        state: "blocked",
        detail: `Your ${destinationCountry} entry depends on your ${d.country} ${d.subtype ?? d.type}, which expires ${d.validUntil ? formatDate(d.validUntil) : "before this trip"} — during or before this trip.`,
        action: "Renew it, or plan for the entry rules that apply without it.",
      });
    } else {
      checks.push({
        id: "cascade-document",
        label: "Supporting document",
        state: "ok",
        detail: "The held document your entry depends on stays valid across these dates.",
      });
    }
  }

  // --- Length of stay against the permitted maximum.
  if (visaStatus?.maxStayDays && tripNights !== null) {
    const stayDays = tripNights + 1;
    if (stayDays > visaStatus.maxStayDays) {
      checks.push({
        id: "max-stay",
        label: "Length of stay",
        state: "blocked",
        detail: `These dates are ${stayDays} days. Your entry permits ${visaStatus.maxStayDays}.`,
        action: "Shorten the trip, or apply for a visa category that allows a longer stay.",
        sourceUrl: visaStatus.sourceUrl ?? null,
      });
    } else if (stayDays > visaStatus.maxStayDays - 3) {
      checks.push({
        id: "max-stay",
        label: "Length of stay",
        state: "warn",
        detail: `These dates are ${stayDays} days against a ${visaStatus.maxStayDays}-day limit — very little room for a delayed flight home.`,
        sourceUrl: visaStatus.sourceUrl ?? null,
      });
    } else {
      checks.push({
        id: "max-stay",
        label: "Length of stay",
        state: "ok",
        detail: `${stayDays} days, within the ${visaStatus.maxStayDays} allowed.`,
        sourceUrl: visaStatus.sourceUrl ?? null,
      });
    }
  }

  // --- The rest of the border checklist, from the curated data set.
  if (countryFact) {
    if (countryFact.blankPagesRequired && countryFact.blankPagesRequired > 0) {
      checks.push({
        id: "blank-pages",
        label: "Blank passport pages",
        state: "warn",
        detail: `${destinationCountry} requires ${countryFact.blankPagesRequired} blank page${countryFact.blankPagesRequired === 1 ? "" : "s"}.`,
        action: "Count them — we can't see inside your passport.",
        sourceUrl: countryFact.passportSourceUrl,
      });
    }

    // Tri-state: true → tell them to carry it; null → we genuinely don't know,
    // and saying nothing would read as "not required"; false → stay quiet.
    if (countryFact.onwardTicketRequired === true) {
      checks.push({
        id: "onward-ticket",
        label: "Proof of onward travel",
        state: "warn",
        detail: `${destinationCountry} requires proof you're leaving — a booked onward or return flight.`,
        action: "Have the booking on your phone at check-in; airlines enforce this even when officers don't.",
        sourceUrl: countryFact.passportSourceUrl,
      });
    } else if (countryFact.onwardTicketRequired === null) {
      checks.push({
        id: "onward-ticket",
        label: "Proof of onward travel",
        state: "unknown",
        detail: `We couldn't confirm either way whether ${destinationCountry} requires proof of onward travel.`,
        action: "Carry a return or onward booking anyway — it costs nothing and airlines ask more often than officers do.",
        sourceUrl: countryFact.passportSourceUrl,
      });
    }

    const requiredVax = countryFact.healthRequiredVaccinations
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (requiredVax.length > 0) {
      checks.push({
        id: "vaccinations",
        label: "Required vaccinations",
        state: "warn",
        detail: `${destinationCountry} requires proof of: ${requiredVax.join(", ")}.`,
        action: "Some of these need weeks to take effect — check now, not the week before.",
        sourceUrl: countryFact.healthSourceUrl,
      });
    }

    if (countryFact.entryRequirementNotes) {
      checks.push({
        id: "entry-notes",
        label: "Also checked at the border",
        state: "warn",
        detail: countryFact.entryRequirementNotes,
        sourceUrl: countryFact.passportSourceUrl,
      });
    }
  } else if (destinationCountry) {
    checks.push({
      id: "country-facts",
      label: "Entry checklist",
      state: "unknown",
      detail: `We haven't researched the entry checklist for ${destinationCountry} yet — passport validity rules, blank pages, onward travel, vaccinations.`,
      action: "The visa answer above still applies; check the rest with the destination's authority.",
    });
  }

  return {
    destinationCountry,
    startDate,
    endDate,
    tripNights,
    daysUntilDeparture,
    visaStatus,
    countryFact,
    checks,
    overall: worst(checks.map((c) => c.state)),
  };
}

export const CHECK_STATE_LABELS: Record<CheckState, string> = {
  ok: "Clear",
  warn: "Check this",
  blocked: "Blocker",
  unknown: "Missing info",
};

export const CHECK_STATE_CLASSES: Record<CheckState, string> = {
  ok: "bg-forest/10 text-forest border-l-forest",
  warn: "bg-stamp/10 text-stamp border-l-stamp",
  blocked: "bg-stampRed/10 text-stampRed border-l-stampRed",
  unknown: "bg-ink/5 text-ink/50 border-l-ink/30",
};

export const CHECK_STATE_DOT_CLASSES: Record<CheckState, string> = {
  ok: "bg-forest",
  warn: "bg-stamp",
  blocked: "bg-stampRed",
  unknown: "bg-ink/30",
};
