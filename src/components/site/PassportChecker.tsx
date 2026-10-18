"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  cascadeDocumentsFor,
  formatVerified,
  resolveCheck,
  type PublicRule,
} from "@/lib/passportCheck";
import VisaStamp, { VISA_TONE } from "./VisaStamp";
import WaitlistForm from "./WaitlistForm";
import ExpandableText from "@/components/ExpandableText";

const docLabel = (country: string) => (country === "USA" ? "US" : country);

/**
 * The public checker: a passport, a destination, an answer — no signup. All
 * rules are passed in as props and resolved in the browser by the same pure
 * function the tests run, so the result is instant and there is no request
 * for a flaky network to fail.
 */
export default function PassportChecker({
  rules,
  passports,
  destinations,
  guideSlugs,
  defaultPassport = "India",
  defaultDestination = "UAE",
}: {
  rules: PublicRule[];
  passports: string[];
  destinations: string[];
  /** country name -> guide slug, for the countries that have a guide page. */
  guideSlugs: Record<string, string>;
  defaultPassport?: string;
  defaultDestination?: string;
}) {
  const uid = useId();
  const [passport, setPassport] = useState(defaultPassport);
  const [destination, setDestination] = useState(defaultDestination);
  const [holdsDoc, setHoldsDoc] = useState(false);

  // The documents that change an answer for whichever passport is typed.
  const matchedPassport = passports.find((p) => p.toLowerCase() === passport.trim().toLowerCase());
  const docs = useMemo(
    () => (matchedPassport ? cascadeDocumentsFor(rules, matchedPassport) : []),
    [rules, matchedPassport]
  );

  const result = resolveCheck(rules, passports, passport, destination, holdsDoc ? docs : []);
  const field =
    "w-full rounded-card border border-white/15 bg-white/[0.06] px-4 py-3 font-body text-[15px] text-white placeholder:text-white/35 focus:border-coral focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/50";

  return (
    <div id="check" className="scroll-mt-20 rounded-panel border border-white/10 bg-nightRaised p-5 sm:p-7">
      <p className="font-stamp text-[11px] uppercase tracking-widest text-white/45">Check a destination</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-passport`} className="mb-1.5 block font-body text-xs font-medium text-white/65">
            Your passport
          </label>
          <input
            id={`${uid}-passport`}
            list={`${uid}-passports`}
            value={passport}
            onChange={(e) => {
              setPassport(e.target.value);
              setHoldsDoc(false);
            }}
            autoComplete="off"
            className={field}
            placeholder="e.g. India"
          />
          <datalist id={`${uid}-passports`}>
            {passports.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor={`${uid}-dest`} className="mb-1.5 block font-body text-xs font-medium text-white/65">
            Where to
          </label>
          <input
            id={`${uid}-dest`}
            list={`${uid}-dests`}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            autoComplete="off"
            className={field}
            placeholder="Search a country"
          />
          <datalist id={`${uid}-dests`}>
            {destinations.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
      </div>

      {docs.map((doc) => (
        <label
          key={doc}
          htmlFor={`${uid}-doc-${doc}`}
          className="mt-4 flex cursor-pointer items-start gap-3 rounded-card border border-white/10 bg-white/[0.03] px-4 py-3"
        >
          <input
            id={`${uid}-doc-${doc}`}
            type="checkbox"
            checked={holdsDoc}
            onChange={(e) => setHoldsDoc(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF5A5F]"
          />
          <span className="font-body text-sm text-white/80">
            I hold a valid {docLabel(doc)} visa
            <span className="block text-xs text-white/45">
              A {docLabel(doc)} visa changes the answer for some {matchedPassport} passport trips.
            </span>
          </span>
        </label>
      ))}

      <div className="mt-5" aria-live="polite">
        <CheckOutput
          result={result}
          guideSlugs={guideSlugs}
          passports={passports}
          waitlistId={`${uid}-wl`}
        />
      </div>
    </div>
  );
}

function CheckOutput({
  result,
  guideSlugs,
  passports,
  waitlistId,
}: {
  result: ReturnType<typeof resolveCheck>;
  guideSlugs: Record<string, string>;
  passports: string[];
  waitlistId: string;
}) {
  if (result.kind === "unsupported-passport") {
    const typed = result.typed;
    return (
      <div className="rounded-card border border-white/10 bg-white/[0.03] p-5">
        <p className="font-display text-lg text-white">
          {typed ? `We don't cover the ${typed} passport yet.` : "Choose a passport to start."}
        </p>
        <p className="mt-1.5 font-body text-sm text-white/60">
          Today we cover {passports.join(", ")}. Each passport is researched rule by rule from
          official sources, so adding one takes real work. Tell us which one you need and we&apos;ll
          count you in.
        </p>
        {typed && (
          <div className="mt-4">
            <WaitlistForm
              interest="passport"
              requestedPassport={typed}
              label="Tell me when it's added"
              inputId={waitlistId}
            />
          </div>
        )}
      </div>
    );
  }

  if (result.kind === "unknown-destination") {
    return (
      <p className="rounded-card border border-white/10 bg-white/[0.03] p-5 font-body text-sm text-white/60">
        {result.typed
          ? `No match for “${result.typed}” yet. Pick a country from the list as you type.`
          : "Search for a country to see the rule."}
      </p>
    );
  }

  if (result.kind === "citizen") {
    return (
      <p className="rounded-card border border-white/10 bg-white/[0.03] p-5 font-body text-sm text-white/70">
        That&apos;s the country on your passport, so no visa applies to you there.
      </p>
    );
  }

  if (result.kind === "no-rule") {
    return (
      <div className="rounded-card border border-white/10 bg-white/[0.03] p-5">
        <p className="font-display text-lg text-white">
          We haven&apos;t researched {result.passport} → {result.destination} yet.
        </p>
        <p className="mt-1.5 font-body text-sm text-white/60">
          That isn&apos;t the same as &ldquo;no visa needed.&rdquo; Check with {result.destination}&apos;s
          embassy or immigration authority before you book.
        </p>
      </div>
    );
  }

  const { rule, viaDocument, stale } = result;
  const tone = VISA_TONE[rule.visaType];
  const guide = guideSlugs[rule.destination];

  return (
    <div className={`rounded-card border bg-white/[0.03] p-5 ${tone.ring}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <VisaStamp type={rule.visaType} />
        {viaDocument && (
          <span className="inline-flex items-center gap-1.5 font-body text-xs font-medium text-coral">
            <ShieldCheck size={14} aria-hidden="true" /> via your {docLabel(viaDocument)} visa
          </span>
        )}
      </div>

      <p className="mt-3 font-display text-xl text-white">
        {rule.passport} passport → {rule.destination}
      </p>

      <dl className="mt-3 grid gap-x-6 gap-y-2 font-body text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-white/45">Maximum stay</dt>
          <dd className="text-white/85">
            {rule.maxStayDays ? `${rule.maxStayDays} days` : "Not stated in the source"}
          </dd>
        </div>
        {rule.feeNotes && (
          <div>
            <dt className="text-xs text-white/45">Fee</dt>
            <dd className="text-white/85">{rule.feeNotes}</dd>
          </div>
        )}
      </dl>

      <ExpandableText text={rule.conditions} max={260} className="mt-3 font-body text-sm leading-relaxed text-white/65" />

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-3 font-body text-xs text-white/50">
        {rule.sourceUrl ? (
          <a
            href={rule.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-white/75 hover:text-coral"
          >
            Official source <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        ) : (
          <span>No source on file</span>
        )}
        <span>Last verified {formatVerified(rule.verified)}</span>
        {guide && (
          <Link href={`/country/${guide}`} className="font-semibold text-white/75 hover:text-coral">
            {rule.destination} guide
          </Link>
        )}
      </div>

      {stale && (
        <p className="mt-3 flex items-start gap-2 font-body text-xs text-stamp">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          This rule was last checked more than six months ago. Confirm it with the official source.
        </p>
      )}
      <p className="mt-3 font-body text-xs text-white/40">
        Not legal advice. Rules change; confirm with the official source before you book.
      </p>
    </div>
  );
}
