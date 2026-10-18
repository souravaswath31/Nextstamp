"use client";

import { useId, useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cascadeComparison, formatVerified, VISA_TYPE_LABEL, type PublicRule } from "@/lib/passportCheck";
import VisaStamp from "./VisaStamp";
import { aOrAn } from "@/lib/article";

const RANK: Record<PublicRule["visaType"], number> = {
  "visa-free": 0,
  "visa-on-arrival": 1,
  "e-visa": 2,
  "advance-visa-required": 3,
};

/**
 * The product's best moment: one switch, and the result list for an Indian
 * passport visibly rearranges. Only destinations the document actually moves
 * are listed as changes — the rest are named underneath so nobody has to take
 * "nothing else changes" on trust.
 */
export default function CascadeDemo({
  rules,
  passport,
  docCountry,
}: {
  rules: PublicRule[];
  passport: string;
  docCountry: string;
}) {
  const uid = useId();
  const [holds, setHolds] = useState(false);
  const docName = docCountry === "USA" ? "US" : docCountry;

  const rows = useMemo(() => cascadeComparison(rules, passport, docCountry), [rules, passport, docCountry]);
  const changed = rows
    .filter((r) => r.changed)
    .sort((a, b) => RANK[a.after.visaType] - RANK[b.after.visaType] || a.destination.localeCompare(b.destination));
  const same = rows.filter((r) => !r.changed);

  return (
    <div className="rounded-panel border border-white/10 bg-nightRaised p-5 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-stamp text-[11px] uppercase tracking-widest text-white/45">{passport} passport</p>
          <p className="mt-1 font-display text-2xl text-white sm:text-3xl">
            {holds
              ? `${changed.length} of ${rows.length} destinations get easier`
              : `${rows.length} destinations on file`}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={holds}
          aria-labelledby={`${uid}-label`}
          onClick={() => setHolds((v) => !v)}
          className="group inline-flex items-center gap-3 self-start rounded-full border border-white/15 bg-white/[0.05] py-2 pl-2 pr-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/60"
        >
          <span
            className={`relative h-7 w-12 rounded-full transition-colors duration-300 ${holds ? "bg-coral" : "bg-white/20"}`}
            aria-hidden="true"
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-300 ${holds ? "translate-x-[22px]" : "translate-x-0.5"}`}
            />
          </span>
          <span id={`${uid}-label`} className="font-body text-sm font-medium text-white">
            I hold a valid {docName} visa
          </span>
        </button>
      </div>

      <ul className="mt-6 divide-y divide-white/10 overflow-hidden rounded-card border border-white/10">
        {changed.map((r) => {
          const shown = holds ? r.after : (r.before ?? r.after);
          return (
            <li
              key={r.destination}
              className={`grid gap-x-4 gap-y-1 px-4 py-3.5 transition-colors duration-500 sm:grid-cols-[10rem_1fr_auto] sm:items-center ${
                holds ? "bg-coral/[0.07]" : "bg-transparent"
              }`}
            >
              <span className="font-display text-base text-white">{r.destination}</span>
              <span className="flex flex-wrap items-center gap-2">
                <VisaStamp type={shown.visaType} />
                {holds && r.before && (
                  <span className="inline-flex items-center gap-1.5 font-body text-xs text-white/45">
                    <span className="line-through">{VISA_TYPE_LABEL[r.before.visaType]}</span>
                    <ArrowRight size={12} aria-hidden="true" />
                    <span className="text-coral">via your {docName} visa</span>
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3 font-body text-xs text-white/50">
                {shown.maxStayDays ? `${shown.maxStayDays} days` : "Stay not stated"}
                {shown.sourceUrl && (
                  <a
                    href={shown.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Official source for ${r.destination}`}
                    className="inline-flex items-center gap-0.5 font-semibold text-white/70 hover:text-coral"
                  >
                    Source <ArrowUpRight size={11} aria-hidden="true" />
                  </a>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 font-body text-xs text-white/50">
        Not moved by {aOrAn(docName)} {docName} visa ({same.length}): {same.map((r) => r.destination).join(", ") || "none"}.
        Those rules are the same either way. Each row was last verified between{" "}
        {formatVerified(rows.map((r) => r.after.verified).sort()[0])} and{" "}
        {formatVerified(rows.map((r) => r.after.verified).sort().slice(-1)[0])}. Not legal advice;
        confirm with the official source before you book.
      </p>
    </div>
  );
}
