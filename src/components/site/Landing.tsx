import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarCheck, FileSearch, Map as MapIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getFeaturedItineraries, getPublicRules, getSiteStats } from "@/lib/siteData";
import { cascadeDocumentsFor, formatVerified } from "@/lib/passportCheck";
import { CATEGORY_LABELS } from "@/lib/types";
import PassportChecker from "./PassportChecker";
import CascadeDemo from "./CascadeDemo";

const SECTION = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const EYEBROW = "font-stamp text-[11px] uppercase tracking-widest text-white/45";

export default async function Landing() {
  const [rules, stats, featured, states, guides] = await Promise.all([
    getPublicRules(),
    getSiteStats(),
    getFeaturedItineraries(6),
    prisma.stateGuide.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }),
    prisma.countryFact.findMany({ select: { country: true } }),
  ]);

  const guideSlugs = Object.fromEntries(
    guides.map((g) => [g.country, g.country.toLowerCase().replace(/\s+/g, "-")])
  );

  // The demo needs a passport that actually has a cascade rule. Prefer India —
  // the worked example — but derive it rather than assume it.
  const cascadePassport =
    stats.passports.includes("India") && cascadeDocumentsFor(rules, "India").length > 0
      ? "India"
      : stats.passports.find((p) => cascadeDocumentsFor(rules, p).length > 0) ?? null;
  const cascadeDoc = cascadePassport ? cascadeDocumentsFor(rules, cascadePassport)[0] : null;

  return (
    <div className="overflow-x-clip">
      {/* 1. Hero */}
      <section className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-20 hidden h-[28rem] w-[28rem] rounded-full border-2 border-dashed border-white/[0.07] lg:block"
        />
        <div className={`${SECTION} grid gap-10 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:items-start lg:gap-14 lg:pb-24`}>
          <div className="lg:pt-6">
            <p className={EYEBROW}>Passport + documents + destination</p>
            <h1 className="mt-4 font-display text-[2.35rem] leading-[1.05] tracking-tightest text-white sm:text-6xl">
              Can you go there with the passport and documents you hold?
            </h1>
            <p className="mt-5 max-w-xl font-body text-lg leading-relaxed text-white/65">
              Pick a passport and a country. You get the visa type, the longest stay, and a link to
              the official rule with the date we checked it, including when a visa you already carry
              changes the answer.
            </p>
            <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-body text-sm text-white/50">
              <span>No signup to check.</span>
              <span>
                {stats.passports.length} passports, {stats.destinations.length} destinations.
              </span>
            </p>
          </div>

          <PassportChecker
            rules={rules}
            passports={stats.passports}
            destinations={stats.destinations}
            guideSlugs={guideSlugs}
          />
        </div>
      </section>

      {/* 2. How it works */}
      <section className="border-t border-white/10">
        <div className={`${SECTION} py-16 sm:py-20`}>
          <p className={EYEBROW}>How it works</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl tracking-tightest text-white sm:text-4xl">
            Three steps, in this order.
          </h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: FileSearch,
                title: "Name your passport and destination",
                body: `No account needed. ${stats.passports.length} passports are covered today, each checked rule by rule against ${stats.destinations.length} destinations.`,
              },
              {
                icon: BadgeCheck,
                title: "Say what else you hold",
                body: "A visa from another country can move you from “apply in advance” to “visa on arrival.” Tell us which ones you have and the answer updates.",
              },
              {
                icon: MapIcon,
                title: "Plan the trip around the answer",
                body: `${stats.itineraries} itineraries, ${stats.states} state guides and ${stats.countryGuides} country guides sit behind it, so a yes turns into a route.`,
              },
            ].map((step, i) => (
              <li key={step.title} className="rounded-panel border border-white/10 bg-nightRaised p-6">
                <div className="flex items-center gap-3">
                  <span className="font-stamp text-xs text-coral">Step {i + 1}</span>
                  <step.icon size={18} className="text-white/35" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-display text-xl text-white">{step.title}</h3>
                <p className="mt-2 font-body text-sm leading-relaxed text-white/60">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 3. Cascade demo */}
      {cascadePassport && cascadeDoc && (
        <section className="border-t border-white/10 bg-nightRaised/40">
          <div className={`${SECTION} py-16 sm:py-20`}>
            <p className={EYEBROW}>The part nothing else does</p>
            <h2 className="mt-3 max-w-3xl font-display text-3xl tracking-tightest text-white sm:text-4xl">
              A {cascadeDoc === "USA" ? "US" : cascadeDoc} visa in your wallet changes what your{" "}
              {cascadePassport} passport can do.
            </h2>
            <p className="mt-3 max-w-2xl font-body text-white/60">
              Most checkers read the passport and stop. Several countries treat a valid visa from
              somewhere else as a reason to ease entry. Flip the switch and watch the list change.
            </p>
            <div className="mt-8">
              <CascadeDemo rules={rules} passport={cascadePassport} docCountry={cascadeDoc} />
            </div>
            <p className="mt-4">
              <Link
                href="/features/visa-check"
                className="inline-flex items-center gap-1.5 font-body text-sm font-semibold text-coral hover:underline"
              >
                How the check works <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </p>
          </div>
        </section>
      )}

      {/* 4. Itineraries */}
      <section className="border-t border-white/10">
        <div className={`${SECTION} py-16 sm:py-20`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className={EYEBROW}>Itineraries</p>
              <h2 className="mt-3 font-display text-3xl tracking-tightest text-white sm:text-4xl">
                Six trips to start with.
              </h2>
            </div>
            <Link href="/explore" className="font-body text-sm font-semibold text-coral hover:underline">
              All {stats.itineraries} itineraries
            </Link>
          </div>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((it) => {
              const first = it.category.split(",")[0];
              const days =
                it.durationDaysMin === it.durationDaysMax
                  ? `${it.durationDaysMin} days`
                  : `${it.durationDaysMin}–${it.durationDaysMax} days`;
              return (
                <li key={it.id}>
                  <Link
                    href={`/itineraries/${it.slug}`}
                    className="group flex h-full flex-col rounded-panel border border-white/10 bg-nightRaised p-6 transition-colors hover:border-white/25 hover:bg-nightLift"
                  >
                    <span className="font-stamp text-[11px] uppercase tracking-widest text-white/45">
                      {CATEGORY_LABELS[first] ?? first} · {days}
                    </span>
                    <h3 className="mt-3 font-display text-xl leading-snug text-white">{it.title}</h3>
                    <p className="mt-2 line-clamp-3 font-body text-sm leading-relaxed text-white/55">
                      {it.description}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-5 font-body text-sm font-semibold text-coral">
                      See the plan
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 5. State guides */}
      <section className="border-t border-white/10 bg-nightRaised/40">
        <div className={`${SECTION} py-16 sm:py-20`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className={EYEBROW}>US state guides</p>
              <h2 className="mt-3 max-w-2xl font-display text-3xl tracking-tightest text-white sm:text-4xl">
                {stats.states} states, {stats.places.toLocaleString("en-US")} places.
              </h2>
            </div>
            <Link href="/states" className="font-body text-sm font-semibold text-coral hover:underline">
              Browse all states
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2">
            {states.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/state/${s.slug}`}
                  className="inline-block rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 font-body text-sm text-white/70 transition-colors hover:border-white/30 hover:text-white"
                >
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 6. Trust strip */}
      <section className="border-t border-white/10">
        <div className={`${SECTION} py-14`}>
          <div className="flex flex-col gap-6 rounded-panel border border-white/10 bg-nightRaised p-6 sm:flex-row sm:items-center sm:gap-10 sm:p-8">
            <CalendarCheck size={28} className="shrink-0 text-coral" aria-hidden="true" />
            <div>
              <h2 className="font-display text-xl text-white sm:text-2xl">Every visa rule is sourced and dated.</h2>
              <p className="mt-2 max-w-3xl font-body text-sm leading-relaxed text-white/60">
                {stats.visaRules} rules across {stats.passports.length} passports and{" "}
                {stats.destinations.length} destinations, each linked to an official source.
                {stats.latestVerified && stats.oldestVerified && (
                  <>
                    {" "}The most recent check was {formatVerified(stats.latestVerified.toISOString().slice(0, 10))};
                    the oldest was {formatVerified(stats.oldestVerified.toISOString().slice(0, 10))}.
                  </>
                )}{" "}
                Rules change, so the date is on every answer. Not legal advice.
              </p>
              <Link
                href="/features/visa-check#sources"
                className="mt-3 inline-flex items-center gap-1.5 font-body text-sm font-semibold text-coral hover:underline"
              >
                How we source them <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Pricing teaser */}
      <section className="border-t border-white/10">
        <div className={`${SECTION} py-16 sm:py-20`}>
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className={EYEBROW}>Pricing</p>
              <h2 className="mt-3 max-w-2xl font-display text-3xl tracking-tightest text-white sm:text-4xl">
                Free to browse and check. $5, once, for the personal parts.
              </h2>
              <p className="mt-3 max-w-2xl font-body text-white/60">
                No subscription. Payment isn&apos;t switched on yet; until it is, everything is free.
              </p>
            </div>
            <Link href="/pricing" className="btn-pill btn-pill-accent self-start">
              See what&apos;s included <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
