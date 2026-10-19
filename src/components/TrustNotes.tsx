import { AlertTriangle, ExternalLink } from "lucide-react";
import { formatVerified } from "@/lib/passportCheck";
import { ruleTrust } from "@/lib/ruleTrust";
import ReportRuleError from "./ReportRuleError";

type Props = {
  conditions: string;
  sourceUrl: string | null;
  /** ISO date or Date the rule was last checked against its source. */
  verified: string | Date | null;
  passport: string;
  destination: string;
  heldDocument?: string | null;
  tone?: "app" | "marketing";
};

const isoOf = (v: string | Date | null) => (v ? (typeof v === "string" ? v : v.toISOString().slice(0, 10)) : null);

// The source line, the honest warnings and the way to report a mistake, in one place so the signed-in
// pages and the public checker say the same thing.
export default function TrustNotes({ conditions, sourceUrl, verified, passport, destination, heldDocument, tone = "app" }: Props) {
  const t = ruleTrust({ conditions, sourceUrl, verified });
  const iso = isoOf(verified);
  const text = tone === "marketing" ? "text-white/60" : "text-ink/65";
  const link = tone === "marketing" ? "text-white/80 hover:text-coral" : "text-forest underline decoration-forest/40 underline-offset-2 hover:decoration-forest";

  const warnings: string[] = [];
  const end = t.validUntil ?? t.changesOn;
  if (t.expired && end) warnings.push(`This rule ended on ${formatVerified(end)}. Open the source for what applies now.`);
  else if (t.endingSoon && end) warnings.push(`${t.validUntil ? "This rule runs out" : "This rule changes"} on ${formatVerified(end)}. Check again before you book.`);
  if (t.band === "recheck") warnings.push(`Checked ${t.ageDays} days ago. Re-check before you book.`);
  if (t.band === "stale") warnings.push("Last checked more than six months ago, so treat it as unconfirmed.");
  if (t.band === "old") warnings.push("Out of date. Do not rely on this; open the source.");
  if (t.caveat) warnings.push("The source leaves some details open. The notes above say which.");
  if (t.advisorySource) warnings.push("Based on another government's travel advice, because the destination's own page could not be read.");

  return (
    <div className="flex flex-col gap-1.5">
      {sourceUrl ? (
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 font-body text-xs ${link}`}>
          {iso ? `Checked ${formatVerified(iso)} against ` : "Source: "}
          {t.sourceHost ?? "the official page"} <ExternalLink size={12} aria-hidden="true" />
        </a>
      ) : (
        <span className={`font-body text-xs ${text}`}>No source on file. Verify before you book.</span>
      )}
      {warnings.map((w) => (
        <p key={w} className="flex items-start gap-1.5 font-body text-xs text-stamp">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> {w}
        </p>
      ))}
      <ReportRuleError passport={passport} destination={destination} heldDocument={heldDocument} tone={tone} />
    </div>
  );
}
