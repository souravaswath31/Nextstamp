import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { CalendarRange, MapPin, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import DestinationBriefing from "@/components/DestinationBriefing";
import Reveal from "@/components/Reveal";
import { getCountryFact, climateForDateRange } from "@/lib/countryFacts";
import { getHolidaysDuring, getUpcomingHolidays } from "@/lib/holidays";
import { getRate } from "@/lib/currency";
import { getFcdoAdvisory, getStateDeptAdvisory } from "@/lib/advisories";
import type { TripDay } from "@/lib/types";

// A read-only public view of a trip, reached by its publicToken. Deliberately
// NOT under /trip — that whole segment is access-controlled, and mixing a
// public route into it is how an access check gets forgotten later.
//
// Nothing personal is rendered: no expenses, no held documents, no entry
// readiness (all of which are specific to the owner's own paperwork). Just the
// plan, the dates, the destination, and the public country briefing.
//
// No loading.tsx sibling here on purpose — see CLAUDE.md on the Next.js 14
// Suspense/redirect interaction.

export const dynamic = "force-dynamic";

async function loadTrip(token: string) {
  if (!token) return null;
  const trip = await prisma.userTrip.findUnique({
    where: { publicToken: token },
    include: { user: { select: { name: true } } },
  });
  // The flag is checked as well as the token so unpublishing takes effect even
  // if a token somehow lingers.
  if (!trip || !trip.isPublic) return null;
  return trip;
}

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const trip = await loadTrip(params.token);
  if (!trip) return { title: "Trip not found — NextStamp" };
  const where = trip.destinationCountry ? ` · ${trip.destinationCountry}` : "";
  return {
    title: `${trip.title}${where} — NextStamp`,
    description: `A trip plan shared from NextStamp${trip.destinationCountry ? `, to ${trip.destinationCountry}` : ""}.`,
    // A shared link is for the people it's sent to, not for search engines.
    robots: { index: false, follow: false },
  };
}

function formatRange(start: Date | null, end: Date | null): string | null {
  if (!start) return null;
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  };
  if (!end) return start.toLocaleDateString("en-US", opts);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  return `${start.toLocaleDateString("en-US", sameYear ? { month: "short", day: "numeric", timeZone: "UTC" } : opts)} – ${end.toLocaleDateString("en-US", opts)}`;
}

export default async function PublicTripPage({ params }: { params: { token: string } }) {
  const trip = await loadTrip(params.token);
  if (!trip) notFound();

  let days: TripDay[] = [];
  try {
    const parsed = JSON.parse(trip.customDaysJson);
    if (Array.isArray(parsed)) days = parsed;
  } catch {
    days = [];
  }

  const fact = trip.destinationCountry ? await getCountryFact(trip.destinationCountry) : null;

  const [holidays, rate, fcdo, stateDept] = await Promise.all([
    trip.startDate
      ? getHolidaysDuring(fact?.iso2, trip.startDate, trip.endDate)
      : getUpcomingHolidays(fact?.iso2, 4),
    fact ? getRate("USD", fact.currencyCode) : Promise.resolve(null),
    trip.destinationCountry ? getFcdoAdvisory(trip.destinationCountry) : Promise.resolve(null),
    fact ? getStateDeptAdvisory(fact.country) : Promise.resolve(null),
  ]);

  const range = formatRange(trip.startDate, trip.endDate);
  const nights =
    trip.startDate && trip.endDate
      ? Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / 86_400_000)
      : null;
  const climate = climateForDateRange(fact?.climate ?? [], trip.startDate, trip.endDate);

  return (
    <div className="space-y-8">
      <div className="-mx-5 overflow-hidden rounded-hero sm:-mx-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/flatlay-trip-planning.jpg" alt="" className="h-32 w-full object-cover sm:h-44" />
      </div>

      <div>
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/45">
          Shared trip plan
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-tightest text-ink sm:text-5xl">
          {trip.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {trip.destinationCountry && (
            <span className="flex items-center gap-1.5 font-body text-sm text-ink/65">
              <MapPin size={14} className="text-ink/35" /> {trip.destinationCountry}
            </span>
          )}
          {range && (
            <span className="flex items-center gap-1.5 font-body text-sm text-ink/65">
              <CalendarRange size={14} className="text-ink/35" /> {range}
            </span>
          )}
          {nights !== null && (
            <span className="flex items-center gap-1.5 font-body text-sm text-ink/65">
              <Clock size={14} className="text-ink/35" /> {nights} night{nights === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <p className="mt-2 font-body text-sm text-ink/50">
          Planned by {trip.user.name} in NextStamp.
        </p>
      </div>

      <section>
        <h2 className="font-display text-2xl text-ink">Day by day</h2>
        {days.length === 0 ? (
          <p className="mt-3 rounded-panel bg-paperDark px-5 py-4 font-body text-sm text-ink/55">
            No days in this plan yet.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {days.map((day, i) => (
              <div key={i} className="rounded-panel bg-paper p-5 shadow-paper">
                <div className="flex items-baseline gap-3">
                  <span className="stamp-mark flex h-8 w-8 shrink-0 items-center justify-center border-stamp font-stamp text-xs font-bold text-stamp">
                    {day.dayNumber}
                  </span>
                  <h3 className="font-display text-lg text-ink">{day.title}</h3>
                </div>
                {day.activities.length > 0 && (
                  <ul className="mt-3 space-y-1.5 pl-11">
                    {day.activities.map((a, j) => (
                      <li key={j} className="font-body text-sm text-ink/70">
                        {a}
                      </li>
                    ))}
                  </ul>
                )}
                {(day.driveTime || day.lodgingSuggestion || day.coffeeWifiSpot) && (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 pl-11">
                    {day.driveTime && (
                      <span className="font-body text-xs text-ink/45">Drive: {day.driveTime}</span>
                    )}
                    {day.lodgingSuggestion && (
                      <span className="font-body text-xs text-ink/45">
                        Stay: {day.lodgingSuggestion}
                      </span>
                    )}
                    {day.coffeeWifiSpot && (
                      <span className="font-body text-xs text-ink/45">
                        Work stop: {day.coffeeWifiSpot}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {fact && (
        <Reveal>
          <div className="space-y-4">
            <h2 className="font-display text-2xl text-ink">Know before you go — {fact.country}</h2>
            <DestinationBriefing
              fact={fact}
              holidays={holidays}
              holidaysAreForTrip={Boolean(trip.startDate)}
              climate={climate}
              rate={rate}
              fcdo={fcdo}
              stateDept={stateDept}
            />
          </div>
        </Reveal>
      )}

      <section className="rounded-panel bg-paper p-6 text-center shadow-paper">
        <p className="font-display text-xl text-ink">Planning something yourself?</p>
        <p className="mx-auto mt-2 max-w-md font-body text-sm text-ink/60">
          NextStamp checks where you can go against the documents you actually hold — your
          passport plus any visas or permits — then helps you plan the rest of it.
        </p>
        <Link href="/" className="btn-pill btn-pill-accent !mt-4">
          See what your passport unlocks
        </Link>
      </section>
    </div>
  );
}
