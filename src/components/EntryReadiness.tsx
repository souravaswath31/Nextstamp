import Link from "next/link";
import { ShieldCheck, ExternalLink, CalendarClock } from "lucide-react";
import {
  CHECK_STATE_CLASSES,
  CHECK_STATE_DOT_CLASSES,
  CHECK_STATE_LABELS,
  type ReadinessReport,
} from "@/lib/readiness";

// Server component — the readiness report is built from the database and the
// user's documents, none of which belongs in the client bundle.

const OVERALL_HEADLINE: Record<string, string> = {
  ok: "Nothing standing between you and the gate",
  warn: "A few things to sort before you fly",
  blocked: "Something here will stop you",
  unknown: "We need a bit more from you",
};

export default function EntryReadiness({
  report,
  compact = false,
}: {
  report: ReadinessReport;
  compact?: boolean;
}) {
  const { checks, overall, destinationCountry, daysUntilDeparture } = report;

  if (checks.length === 0) {
    return null;
  }

  // Blockers first, then things to check, then missing info, then the clear
  // ones — a checklist sorted by what needs doing rather than by the order
  // the engine happened to produce.
  const order: Record<string, number> = { blocked: 0, warn: 1, unknown: 2, ok: 3 };
  const sorted = [...checks].sort((a, b) => order[a.state] - order[b.state]);
  const blockers = checks.filter((c) => c.state === "blocked").length;

  return (
    <section className="rounded-panel bg-paper p-6 shadow-paper">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl text-ink">
            <ShieldCheck size={19} className="text-ink/35" /> Entry readiness
          </h2>
          <p className="mt-1 font-body text-sm text-ink/60">
            {OVERALL_HEADLINE[overall]}
            {destinationCountry ? ` — ${destinationCountry}.` : "."}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 font-stamp text-[11px] uppercase tracking-wide ${
            CHECK_STATE_CLASSES[overall].split(" border-l-")[0]
          }`}
        >
          {blockers > 0
            ? `${blockers} blocker${blockers === 1 ? "" : "s"}`
            : CHECK_STATE_LABELS[overall]}
        </span>
      </div>

      {daysUntilDeparture !== null && daysUntilDeparture >= 0 && (
        <p className="mt-3 flex items-center gap-1.5 font-body text-xs text-ink/50">
          <CalendarClock size={13} />
          {daysUntilDeparture === 0
            ? "You leave today."
            : `${daysUntilDeparture} day${daysUntilDeparture === 1 ? "" : "s"} until departure.`}
        </p>
      )}

      <div className="mt-5 space-y-3">
        {sorted.map((check) => (
          <div
            key={check.id}
            className={`rounded-card border-l-[3px] px-4 py-3 ${CHECK_STATE_CLASSES[check.state]}`}
          >
            <div className="flex items-baseline gap-2">
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${CHECK_STATE_DOT_CLASSES[check.state]}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="font-body text-sm font-semibold text-ink">{check.label}</p>
                <p className="mt-0.5 font-body text-sm text-ink/70">{check.detail}</p>
                {check.action && (
                  <p className="mt-1.5 font-body text-xs text-ink/55">{check.action}</p>
                )}
                {check.sourceUrl && (
                  <a
                    href={check.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 font-body text-xs font-semibold text-coralDark hover:underline"
                  >
                    Official source <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!compact && (
        <p className="mt-5 font-body text-xs text-ink/45">
          Checked against your passport, your held documents, and this trip&apos;s dates. We show
          what our sources say and when they were last verified — entry policies change, so
          confirm anything critical with the official source before you book.{" "}
          <Link href="/profile" className="font-semibold text-ink/60 hover:underline">
            Update your documents
          </Link>
          .
        </p>
      )}
    </section>
  );
}
