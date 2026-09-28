import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getOptionalUser } from "@/lib/currentUser";
import DestinationBriefing from "@/components/DestinationBriefing";
import BackButton from "@/components/BackButton";
import Reveal from "@/components/Reveal";
import VisaBadge from "@/components/VisaBadge";
import ItineraryCard from "@/components/ItineraryCard";
import { getVisaStatusForUser } from "@/lib/visa";
import { getUpcomingHolidays } from "@/lib/holidays";
import { getRate } from "@/lib/currency";
import { getFcdoAdvisory, getStateDeptAdvisory } from "@/lib/advisories";
import { splitSources, type CountryFactFull } from "@/lib/countryFacts";

// The curated country data set as a browsable page — part of the free content
// library, like /states. Intentionally public: personalization (the visa
// answer for *your* passport) appears only when there's a signed-in user to
// personalize for, same pattern as /itinerary/[id].

export const dynamic = "force-dynamic";

function slugify(country: string): string {
  return country.toLowerCase().replace(/\s+/g, "-");
}

async function loadFact(slug: string): Promise<CountryFactFull | null> {
  // Matched by slugifying the stored country names rather than storing a slug
  // column: the set is ~20 rows, and one fewer field to keep in sync with the
  // research pipeline is worth more than the query.
  const all = await prisma.countryFact.findMany({
    include: {
      climate: { orderBy: { monthNumber: "asc" } },
      phrases: { orderBy: { sortOrder: "asc" } },
    },
  });
  return all.find((f) => slugify(f.country) === slug.toLowerCase()) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const fact = await loadFact(params.slug);
  if (!fact) return {};
  const description = `Entry requirements, climate month by month, money, plugs, emergency numbers and a phrasebook for ${fact.country} — sourced and dated.`;
  return {
    title: `${fact.country} travel guide — NextStamp`,
    description,
    openGraph: { title: `${fact.country} — NextStamp`, description },
  };
}

export default async function CountryPage({ params }: { params: { slug: string } }) {
  const fact = await loadFact(params.slug);
  if (!fact) notFound();

  const user = await getOptionalUser();

  const [holidays, rate, fcdo, stateDept, visaStatus, itineraries] = await Promise.all([
    getUpcomingHolidays(fact.iso2, 5),
    getRate("USD", fact.currencyCode),
    getFcdoAdvisory(fact.country),
    getStateDeptAdvisory(fact.country),
    user ? getVisaStatusForUser(user, fact.country) : Promise.resolve(null),
    prisma.itinerary.findMany({
      where: { countries: { contains: fact.country } },
      take: 6,
      orderBy: { title: "asc" },
    }),
  ]);

  const sources = splitSources(fact.sources);

  return (
    <div className="space-y-8">
      <BackButton label="Back" />

      <div>
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/45">Country guide</p>
        <h1 className="mt-2 font-display text-5xl tracking-tightest text-ink sm:text-6xl">
          {fact.country}
        </h1>
        <p className="mt-3 font-body text-base text-ink/65">
          {fact.currencyName} · {fact.timezoneLabel}
          {fact.phrasesLanguage ? ` · ${fact.phrasesLanguage}` : ""}
        </p>
        <p className="mt-2 font-body text-xs text-ink/40">
          Last verified{" "}
          {fact.lastVerifiedDate.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })}
          . We show the date because entry rules change and a stale answer is worse than none.
        </p>
      </div>

      {/* --- The personalized part, when there's someone to personalize for. */}
      {user && visaStatus ? (
        <section className="rounded-panel bg-paper p-6 shadow-paper">
          <h2 className="flex items-center gap-2 font-display text-lg text-ink">
            <ShieldCheck size={17} className="text-ink/35" /> Your entry, {fact.country}
          </h2>
          <div className="mt-3">
            <VisaBadge status={visaStatus} />
          </div>
        </section>
      ) : (
        <section className="rounded-panel bg-paper p-6 shadow-paper">
          <p className="flex items-center gap-2 font-display text-lg text-ink">
            <Sparkles size={17} className="text-ink/35" /> Can you enter {fact.country}?
          </p>
          <p className="mt-1.5 font-body text-sm text-ink/60">
            Everything below is the same for everyone. Whether you need a visa isn&apos;t — it
            depends on your passport and any visas or permits you already hold.
          </p>
          <Link href="/login" className="btn-pill btn-pill-accent !mt-4 !px-4 !py-1.5 !text-xs">
            Check it for your documents
          </Link>
        </section>
      )}

      {/* --- Entry requirements, laid out as reference rather than as a
          --- trip-specific checklist (there's no trip here to check against). */}
      <section className="rounded-panel bg-paper p-6 shadow-paper">
        <h2 className="font-display text-lg text-ink">Entry requirements</h2>
        <dl className="mt-3 space-y-3">
          <div>
            <dt className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
              Passport validity
            </dt>
            <dd className="font-body text-sm text-ink/75">{fact.passportValidityRule}</dd>
          </div>
          {fact.blankPagesRequired !== null && (
            <div>
              <dt className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
                Blank pages
              </dt>
              <dd className="font-body text-sm text-ink/75">
                {fact.blankPagesRequired} required
              </dd>
            </div>
          )}
          <div>
            <dt className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
              Proof of onward travel
            </dt>
            <dd className="font-body text-sm text-ink/75">
              {fact.onwardTicketRequired === true &&
                "Required — have a booked onward or return flight to hand."}
              {fact.onwardTicketRequired === false &&
                "Not stated as a requirement by this destination."}
              {/* null is not the same as "no": it means nobody could confirm it
                  either way, and rendering that as "not required" would be a
                  claim we can't stand behind. */}
              {fact.onwardTicketRequired === null &&
                "We couldn't confirm this either way — carry a return or onward booking regardless, since airlines ask more often than border officers do."}
            </dd>
          </div>
          {fact.entryRequirementNotes && (
            <div>
              <dt className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
                Also checked
              </dt>
              <dd className="font-body text-sm text-ink/75">{fact.entryRequirementNotes}</dd>
            </div>
          )}
        </dl>
        {fact.passportSourceUrl && (
          <a
            href={fact.passportSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 font-body text-xs font-semibold text-coralDark hover:underline"
          >
            Official source <ExternalLink size={11} />
          </a>
        )}
      </section>

      <Reveal>
        <DestinationBriefing
          fact={fact}
          holidays={holidays}
          holidaysAreForTrip={false}
          climate={fact.climate}
          rate={rate}
          fcdo={fcdo}
          stateDept={stateDept}
        />
      </Reveal>

      {itineraries.length > 0 && (
        <Reveal>
          <section>
            <h2 className="font-display text-2xl text-ink">Trips that go here</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {itineraries.map((it) => (
                <ItineraryCard
                  key={it.id}
                  id={it.id}
                  title={it.title}
                  region={it.region}
                  countries={it.countries}
                  category={it.category}
                  durationDaysMin={it.durationDaysMin}
                  durationDaysMax={it.durationDaysMax}
                  costTier={it.costTier}
                  bestTimeMonths={it.bestTimeMonths}
                  coverImageUrl={it.coverImageUrl}
                />
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {sources.length > 0 && (
        <section className="rounded-panel bg-paperDark p-5">
          <h2 className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
            Every source behind this page
          </h2>
          <ul className="mt-2 space-y-1">
            {sources.map((s) => (
              <li key={s}>
                <a
                  href={s}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-body text-xs text-ink/50 hover:text-coralDark hover:underline"
                >
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
