import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOptionalUser } from "@/lib/currentUser";
import { getVisaStatusForUser, type VisaStatus } from "@/lib/visa";
import { createTripFromItinerary } from "@/lib/actions";
import VisaBadge from "@/components/VisaBadge";
import Reveal from "@/components/Reveal";
import { CATEGORY_LABELS, CATEGORY_COLOR_CLASSES } from "@/lib/types";
import { generatePackingList } from "@/lib/packing";
import { estimateTripCost, getBudgetBreakdown, formatUsd } from "@/lib/costs";
import BackButton from "@/components/BackButton";
import RouteMap from "@/components/RouteMap";
import {
  CalendarDays,
  Sun,
  Wallet,
  Wallet2,
  UtensilsCrossed,
  Car,
  Bed,
  Wifi,
  PackageCheck,
  Sparkles,
  LogIn,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

// Best-effort regional match for the food/culture section's banner photo —
// approximate by design (only 4 scene photos exist), not meant to be a
// precise claim about any specific country.
const COUNTRY_SCENE: Record<string, string> = {
  Indonesia: "/scene-market-asia.jpg",
  Japan: "/scene-market-asia.jpg",
  Thailand: "/scene-market-asia.jpg",
  Vietnam: "/scene-market-asia.jpg",
  Philippines: "/scene-market-asia.jpg",
  Maldives: "/scene-market-asia.jpg",
  "Sri Lanka": "/scene-market-asia.jpg",
  Turkey: "/scene-cafe-mediterranean.jpg",
  Georgia: "/scene-cafe-mediterranean.jpg",
  Armenia: "/scene-cafe-mediterranean.jpg",
  UAE: "/scene-cafe-mediterranean.jpg",
  Egypt: "/scene-cafe-mediterranean.jpg",
  Morocco: "/scene-cafe-mediterranean.jpg",
  Mexico: "/scene-market-latin-america.jpg",
  Colombia: "/scene-market-latin-america.jpg",
  Peru: "/scene-market-latin-america.jpg",
  "Costa Rica": "/scene-market-latin-america.jpg",
  Serbia: "/scene-alley-europe.jpg",
};

function sceneImageFor(countries: string[]): string | null {
  for (const c of countries) {
    if (COUNTRY_SCENE[c]) return COUNTRY_SCENE[c];
  }
  return null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const itinerary = await prisma.itinerary.findUnique({ where: { id: params.id } });
  if (!itinerary) return {};
  return {
    title: `${itinerary.title} — NextStamp`,
    description: itinerary.description,
    openGraph: { title: `${itinerary.title} — NextStamp`, description: itinerary.description },
  };
}

export default async function ItineraryDetailPage({ params }: { params: { id: string } }) {
  // Part of the free browsable library — no login required to view a trip
  // plan. Only the "visa status for you" section needs a real passport, so
  // that's the one part that becomes a sign-in prompt instead of a badge.
  const user = await getOptionalUser();
  const itinerary = await prisma.itinerary.findUnique({
    where: { id: params.id },
    include: { days: { orderBy: { dayNumber: "asc" } }, notes: true },
  });

  if (!itinerary) notFound();

  const countries = itinerary.countries.split(",").filter(Boolean);
  const visaStatuses: VisaStatus[] | null = user
    ? await Promise.all(countries.map((c) => getVisaStatusForUser(user, c)))
    : null;

  // Which of this itinerary's countries have a researched country guide, so
  // the visa card can link through to the rest of what you need to know.
  const guideCountries = new Set(
    (
      await prisma.countryFact.findMany({
        where: { country: { in: countries } },
        select: { country: true },
      })
    ).map((f) => f.country)
  );

  const relatedStateSlugs = itinerary.relatedStateSlugs ? itinerary.relatedStateSlugs.split(",").filter(Boolean) : [];
  const relatedStates = relatedStateSlugs.length > 0
    ? await prisma.stateGuide.findMany({ where: { slug: { in: relatedStateSlugs } } })
    : [];

  const createTrip = createTripFromItinerary.bind(null, itinerary.id);
  const sceneImage = sceneImageFor(countries);

  return (
    <div className="space-y-14">
      <div>
        <BackButton label="Back to Explore" />
        {itinerary.coverImageUrl && (
          <div className="-mx-5 mt-6 overflow-hidden rounded-hero sm:-mx-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={itinerary.coverImageUrl}
              alt=""
              className="h-48 w-full object-cover sm:h-72"
            />
          </div>
        )}
        <div className="mt-6 text-center sm:text-left">
          <p className="font-stamp text-xs uppercase tracking-widest text-ink/45">
            {itinerary.region} · {countries.join(", ")}
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-tightest text-ink sm:text-6xl">{itinerary.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl font-body text-lg text-ink/60 sm:mx-0">{itinerary.description}</p>

          <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
            {itinerary.category.split(",").filter(Boolean).map((c) => (
              <span key={c} className={`rounded-full px-3 py-1 font-body text-xs font-medium ${CATEGORY_COLOR_CLASSES[c] ?? "bg-line/40 text-ink/70"}`}>
                {CATEGORY_LABELS[c] ?? c}
              </span>
            ))}
          </div>
        </div>
      </div>

      <Reveal>
        <section className="grid gap-6 rounded-panel bg-paper p-6 shadow-paper sm:grid-cols-3">
          <div className="flex gap-3">
            <CalendarDays size={17} className="mt-0.5 shrink-0 text-coralDark" />
            <div>
              <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
                Duration
              </p>
              <p className="mt-0.5 font-body text-sm text-ink">
                {itinerary.durationDaysMin === itinerary.durationDaysMax
                  ? `${itinerary.durationDaysMin} days`
                  : `${itinerary.durationDaysMin}–${itinerary.durationDaysMax} days`}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Sun size={17} className="mt-0.5 shrink-0 text-stamp" />
            <div>
              <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
                Best time
              </p>
              <p className="mt-0.5 font-body text-sm text-ink">
                {itinerary.bestTimeMonths.split(",").join(", ")} — {itinerary.bestTimeDescription}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Wallet size={17} className="mt-0.5 shrink-0 text-forest" />
            <div>
              <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
                Budget tier
              </p>
              <p className="mt-0.5 font-body text-sm capitalize text-ink">{itinerary.costTier}</p>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="rounded-panel bg-gradient-to-br from-coral/[0.06] to-transparent p-6 shadow-paper sm:p-8">
          <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
            Estimated cost for {itinerary.durationDaysMin} days, per person
          </p>
          <p className="mt-1 font-display text-4xl text-coralDark">
            {formatUsd(estimateTripCost(itinerary.durationDaysMin, itinerary.costTier as any))}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(() => {
              const breakdown = getBudgetBreakdown(estimateTripCost(itinerary.durationDaysMin, itinerary.costTier as any));
              return (
                <>
                  <BudgetLine icon={Bed} label="Lodging" amount={breakdown.lodging} />
                  <BudgetLine icon={UtensilsCrossed} label="Food" amount={breakdown.food} />
                  <BudgetLine icon={Car} label="Local transport" amount={breakdown.transport} />
                  <BudgetLine icon={Wallet2} label="Activities" amount={breakdown.activities} />
                </>
              );
            })()}
          </div>
          <p className="mt-5 font-body text-xs text-ink/45">
            Rough split based on typical vacation spending patterns, not this destination specifically — doesn't include flights. Adjust the tier once you're planning to see the estimate change.
          </p>
        </section>
      </Reveal>

      <Reveal>
        <section>
          <h2 className="font-display text-2xl text-ink">Visa status for you</h2>
          {visaStatuses ? (
            <div className="mt-4 space-y-3">
              {countries.map((country, i) => (
                <div key={country} className="rounded-panel bg-paper p-5 shadow-paper">
                  <p className="font-body text-sm font-medium text-ink">{country}</p>
                  <div className="mt-2">
                    <VisaBadge status={visaStatuses[i]} />
                  </div>
                  {visaStatuses[i].conditionsText && (
                    <p className="mt-2 font-body text-xs text-ink/55">
                      {visaStatuses[i].conditionsText}
                      {visaStatuses[i].maxStayDays
                        ? ` Max stay: ${visaStatuses[i].maxStayDays} days.`
                        : ""}
                    </p>
                  )}
                  {guideCountries.has(country) && (
                    <Link
                      href={`/country/${country.toLowerCase().replace(/\s+/g, "-")}`}
                      className="btn-ghost !mt-3 !text-xs"
                    >
                      {country} country guide <ArrowRight size={12} />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-panel bg-paper p-6 text-center shadow-paper sm:flex-row sm:justify-between sm:text-left">
              <p className="font-body text-sm text-ink/60">
                Sign in and set your passport to see whether {countries.join(", ")} needs a visa for you.
              </p>
              <Link href="/login" className="btn-pill btn-pill-primary shrink-0">
                <LogIn size={15} /> Sign in
              </Link>
            </div>
          )}
        </section>
      </Reveal>

      <Reveal>
        <RouteMap
          heading="Where this trip goes"
          stops={itinerary.days
            .filter(
              (d): d is typeof d & { latitude: number; longitude: number } =>
                d.latitude !== null && d.longitude !== null
            )
            .map((d) => ({
              dayNumber: d.dayNumber,
              title: d.title,
              latitude: d.latitude,
              longitude: d.longitude,
            }))}
          unmappedCount={itinerary.days.filter((d) => d.latitude === null).length}
        />
      </Reveal>

      <Reveal>
        <section>
          <h2 className="font-display text-2xl text-ink">Day by day</h2>
          <div className="mt-5 space-y-0 rounded-panel bg-paper px-6 shadow-paper sm:px-8">
            {itinerary.days.map((day, idx) => (
              <div
                key={day.id}
                className={`flex gap-4 py-5 ${idx > 0 ? "ticket-divider" : ""}`}
              >
                <span className="stamp-mark mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border-stamp font-stamp text-sm font-bold text-stamp">
                  {day.dayNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg text-ink">{day.title}</h3>
                  <ul className="mt-2 list-inside list-disc font-body text-sm text-ink/70">
                    {day.activities.split("|").filter(Boolean).map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 font-body text-xs text-ink/45">
                    {day.driveTime && (
                      <span className="flex items-center gap-1"><Car size={13} /> {day.driveTime}</span>
                    )}
                    {day.lodgingSuggestion && (
                      <span className="flex items-center gap-1"><Bed size={13} /> {day.lodgingSuggestion}</span>
                    )}
                    {day.coffeeWifiSpot && (
                      <span className="flex items-center gap-1"><Wifi size={13} /> {day.coffeeWifiSpot}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {itinerary.notes.length > 0 && (
        <Reveal>
          <section>
            <h2 className="font-display text-2xl text-ink">Food, drink & culture</h2>
            <p className="mt-1 font-body text-sm text-ink/55">
              What the place actually tastes and sounds like, not just how it looks.
            </p>
            {sceneImage && (
              <div className="mt-4 overflow-hidden rounded-panel">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sceneImage} alt="" className="h-40 w-full object-cover sm:h-56" />
              </div>
            )}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {itinerary.notes.map((note) => (
                <div key={note.id} className="card-lift rounded-panel bg-paper p-5 shadow-paper">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-base text-ink">{note.name}</h3>
                    {note.placeType && (
                      <span className="whitespace-nowrap font-stamp text-[10px] uppercase text-ink/40">
                        {note.placeType}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 font-body text-sm text-ink/65">{note.description}</p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {itinerary.notes.length === 0 && relatedStates.length > 0 && (
        <Reveal>
          <section>
            <h2 className="font-display text-2xl text-ink">Food, drink & culture</h2>
            <p className="mt-1 font-body text-sm text-ink/55">
              This trip's food and culture depth lives in{" "}
              {relatedStates.length === 1 ? "our destination guide for" : "our destination guides for"}{" "}
              {relatedStates.map((s) => s.name).join(" and ")} — not repeated here twice.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {relatedStates.map((s) => (
                <Link
                  key={s.id}
                  href={`/state/${s.slug}`}
                  className="card-lift group block rounded-panel bg-paper p-5 shadow-paper"
                >
                  <h3 className="btn-ghost font-display text-base text-ink">{s.name} guide →</h3>
                  <p className="mt-1.5 font-body text-sm text-ink/65">{s.heroTagline}</p>
                </Link>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      <Reveal>
        <section>
          <h2 className="font-display text-2xl text-ink">What to pack</h2>
          <p className="mt-1 font-body text-sm text-ink/55">
            Based on what this trip actually involves — not a generic everything-list.
          </p>
          <div className="mt-4 overflow-hidden rounded-panel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/flatlay-packing.jpg" alt="" className="h-40 w-full object-cover sm:h-56" />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {generatePackingList(itinerary.category.split(",").filter(Boolean)).map((section) => (
              <div key={section.title} className="card-lift rounded-panel bg-paper p-5 shadow-paper">
                <p className="flex items-center gap-1.5 font-stamp text-[11px] uppercase tracking-wide text-stamp">
                  <PackageCheck size={13} /> {section.title}
                </p>
                <ul className="mt-2 list-inside list-disc font-body text-sm text-ink/70">
                  {section.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      <form action={createTrip} className="flex justify-center pt-2 sm:justify-start">
        <button type="submit" className="btn-pill btn-pill-accent">
          <Sparkles size={16} /> Start planning this trip
        </button>
      </form>
    </div>
  );
}

function BudgetLine({
  icon: Icon,
  label,
  amount,
}: {
  icon: LucideIcon;
  label: string;
  amount: number;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={15} className="mt-0.5 shrink-0 text-ink/30" />
      <div>
        <p className="font-body text-xs text-ink/50">{label}</p>
        <p className="font-display text-base text-ink">{formatUsd(amount)}</p>
      </div>
    </div>
  );
}
