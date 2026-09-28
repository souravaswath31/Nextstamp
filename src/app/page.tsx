import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { getCascadeExplorer } from "@/lib/visa";
import { getExpiryStatus, isUrgent, EXPIRY_SEVERITY_CLASSES } from "@/lib/documents";
import { buildReadinessReport } from "@/lib/readiness";
import ItineraryCard from "@/components/ItineraryCard";
import StatusPill from "@/components/StatusPill";
import Reveal from "@/components/Reveal";
import type { TripStatus } from "@/lib/types";
import {
  Trophy,
  CalendarCheck,
  Compass as CompassIcon,
  ArrowRight,
  MapPinned,
  AlertOctagon,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  const trips = await prisma.userTrip.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  const activeTrips = trips.filter((t) => t.status === "planning" || t.status === "booked");
  const completedTrips = trips.filter((t) => t.status === "completed");
  const thisYear = new Date().getFullYear();
  const tripsThisYear = trips.filter(
    (t) => t.status === "completed" && t.completedDate && new Date(t.completedDate).getFullYear() === thisYear
  ).length;

  const highlights = await prisma.itinerary.findMany({
    take: 3,
    orderBy: { createdAt: "asc" },
  });

  // The one thing a chat tool structurally can't do: watch a document over
  // time and warn you before it silently takes your cascade access with
  // it. Compute this once here so it can sit at the top of the dashboard,
  // not buried on the Profile page where nobody checks unprompted.
  const upcomingDocuments = await Promise.all(
    user.heldDocuments.map(async (doc) => {
      const expiry = getExpiryStatus(doc.validUntil);
      if (!isUrgent(expiry)) return null;
      const unlocks = await getCascadeExplorer(user.passportCountry, doc.country);
      return { doc, expiry, unlocks };
    })
  ).then((rows) => rows.filter((r): r is NonNullable<typeof r> => r !== null));

  // The passport itself belongs in the same widget as the documents that hang
  // off it — a passport quietly aging out invalidates every trip at once.
  const passportExpiry = getExpiryStatus(user.passportExpiry);
  const passportUrgent = user.passportExpiry !== null && isUrgent(passportExpiry);

  // The nearest trip with a start date in the future. This is the number
  // someone with a trip booked actually wants on their dashboard.
  const todayUtc = new Date();
  const startOfToday = Date.UTC(
    todayUtc.getUTCFullYear(),
    todayUtc.getUTCMonth(),
    todayUtc.getUTCDate()
  );
  const nextTrip = trips
    .filter((t) => t.status !== "completed" && t.startDate && t.startDate.getTime() >= startOfToday)
    .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())[0];
  const daysToNextTrip = nextTrip?.startDate
    ? Math.round(
        (Date.UTC(
          nextTrip.startDate.getUTCFullYear(),
          nextTrip.startDate.getUTCMonth(),
          nextTrip.startDate.getUTCDate()
        ) -
          startOfToday) /
          86_400_000
      )
    : null;

  // Blocking entry problems across every upcoming trip, surfaced here rather
  // than only inside each trip — the whole point of knowing your dates.
  const tripBlockers = (
    await Promise.all(
      trips
        .filter((t) => t.status !== "completed" && t.destinationCountry && t.startDate)
        .map(async (t) => {
          const report = await buildReadinessReport(user, t);
          const blocked = report.checks.filter((c) => c.state === "blocked");
          return blocked.length > 0 ? { trip: t, blocked } : null;
        })
    )
  ).filter((r): r is NonNullable<typeof r> => r !== null);

  const countryGuideCount = await prisma.countryFact.count();

  return (
    <div className="space-y-20 sm:space-y-28">
      <section className="pt-6 text-center sm:pt-14">
        <p className="flex items-center justify-center gap-1.5 font-stamp text-xs uppercase tracking-widest text-ink/45">
          <MapPinned size={13} /> {user.homeBaseLocation ?? "Home base not set"}
        </p>
        <h1 className="mx-auto mt-3 max-w-2xl font-display text-5xl leading-[1.05] tracking-tightest text-ink sm:text-6xl">
          Where to <span className="text-coral">next</span>, {user.name}?
        </h1>
      </section>

      <Reveal>
        <div className="-mx-5 overflow-hidden rounded-hero sm:-mx-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-sunrise-runway.jpg"
            alt=""
            className="h-40 w-full object-cover sm:h-56"
          />
        </div>
      </Reveal>

      {nextTrip && daysToNextTrip !== null && (
        <Reveal>
          <Link
            href={`/trip/${nextTrip.id}`}
            className="card-lift block rounded-panel bg-paper px-6 py-5 shadow-paper"
          >
            <p className="font-stamp text-[11px] uppercase tracking-widest text-ink/45">
              Next trip
            </p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-3xl tracking-tightest text-ink">
                {nextTrip.title}
              </span>
              <span className="font-display text-2xl text-coral">
                {daysToNextTrip === 0
                  ? "today"
                  : `in ${daysToNextTrip} day${daysToNextTrip === 1 ? "" : "s"}`}
              </span>
            </div>
            <p className="mt-1 font-body text-sm text-ink/55">
              {nextTrip.destinationCountry ?? "No destination set"}
              {nextTrip.startDate
                ? ` · leaves ${nextTrip.startDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    timeZone: "UTC",
                  })}`
                : ""}
            </p>
          </Link>
        </Reveal>
      )}

      {(upcomingDocuments.length > 0 || passportUrgent || tripBlockers.length > 0) && (
        <Reveal>
          <section>
            <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
              <AlertOctagon size={20} className="text-stampRed" /> Coming up
            </h2>
            <div className="mt-4 space-y-3">
              {/* Entry blockers first: these stop a trip happening at all. */}
              {tripBlockers.map(({ trip, blocked }) => (
                <div
                  key={trip.id}
                  className="rounded-panel border-l-4 border-l-stampRed bg-stampRed/5 px-5 py-4 shadow-paper"
                >
                  <p className="font-body text-sm font-semibold text-stampRed">
                    {trip.title} — {blocked.length} thing{blocked.length === 1 ? "" : "s"} will stop
                    you at the gate
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {blocked.map((c) => (
                      <li key={c.id} className="font-body text-sm text-ink/70">
                        {c.label}: {c.detail}
                      </li>
                    ))}
                  </ul>
                  <span className="btn-ghost mt-2 text-sm">
                    Open the trip <ArrowRight size={13} />
                  </span>
                </div>
              ))}

              {passportUrgent && (
                <div
                  className={`rounded-panel border-l-4 bg-paper px-5 py-4 shadow-paper ${EXPIRY_SEVERITY_CLASSES[passportExpiry.severity]}`}
                >
                  <p className="font-body text-sm font-semibold text-ink">
                    Your passport {passportExpiry.label.toLowerCase()}
                  </p>
                  <p className="mt-1 font-body text-sm text-ink/60">
                    Most destinations want six months&apos; validity beyond your arrival date, so
                    this closes off more than the expiry date suggests.
                  </p>
                  <Link href="/profile" className="btn-ghost mt-2 text-sm">
                    Review in Profile <ArrowRight size={13} />
                  </Link>
                </div>
              )}

              {upcomingDocuments.map(({ doc, expiry, unlocks }) => (
                <div key={doc.id} className={`rounded-panel border-l-4 bg-paper px-5 py-4 shadow-paper ${EXPIRY_SEVERITY_CLASSES[expiry.severity]}`}>
                  <p className="font-body text-sm font-semibold text-ink">
                    Your {doc.country} {doc.subtype ?? "document"} {expiry.label.toLowerCase()}
                  </p>
                  {unlocks.length > 0 && (
                    <p className="mt-1 font-body text-sm text-ink/60">
                      This is what unlocks your visa-free or on-arrival access to{" "}
                      {unlocks.map((u) => u.destinationCountry).join(", ")} — renewing it (or noting the
                      lapse) keeps that accurate.
                    </p>
                  )}
                  <Link href="/profile" className="btn-ghost mt-2 text-sm">
                    Review in Profile <ArrowRight size={13} />
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      <Reveal>
        <section className="grid grid-cols-3 gap-4">
          <Stat
            icon={Trophy}
            label="Completed trips"
            value={completedTrips.length}
            colorClass="text-forest"
            tintClass="bg-forest/[0.06]"
          />
          <Stat
            icon={CalendarCheck}
            label="Completed this year"
            value={tripsThisYear}
            colorClass="text-teal"
            tintClass="bg-teal/[0.06]"
          />
          <Stat
            icon={CompassIcon}
            label="In planning"
            value={activeTrips.length}
            colorClass="text-coralDark"
            tintClass="bg-coral/[0.06]"
          />
        </section>
      </Reveal>

      <Reveal>
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl text-ink">Active trips</h2>
            <Link href="/my-trips" className="btn-ghost text-sm">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {activeTrips.length === 0 ? (
            <p className="mt-4 font-body text-sm text-ink/50">
              Nothing in planning yet. Browse the library and start one.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {activeTrips.map((trip) => (
                <Link
                  key={trip.id}
                  href={`/trip/${trip.id}`}
                  className="card-lift flex flex-wrap items-center justify-between gap-2 rounded-panel bg-paper px-5 py-4 shadow-paper"
                >
                  <div>
                    <span className="font-display text-base text-ink">{trip.title}</span>
                    {(trip.destinationCountry || trip.startDate) && (
                      <p className="font-body text-xs text-ink/50">
                        {[
                          trip.destinationCountry,
                          trip.startDate
                            ? trip.startDate.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                timeZone: "UTC",
                              })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <StatusPill status={trip.status as TripStatus} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </Reveal>

      {countryGuideCount > 0 && (
        <Reveal>
          <Link
            href="/countries"
            className="card-lift block rounded-panel bg-paper px-6 py-5 shadow-paper"
          >
            <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
              <BookOpen size={20} className="text-ink/35" /> Country guides
            </h2>
            <p className="mt-1.5 max-w-xl font-body text-sm text-ink/60">
              Passport validity rules, climate month by month, what the emergency number actually
              is, which plug, whether anyone takes a card, and a phrasebook worth knowing — for{" "}
              {countryGuideCount} {countryGuideCount === 1 ? "country" : "countries"}, each fact
              sourced and dated.
            </p>
            <span className="btn-ghost mt-2 text-sm">
              Browse the guides <ArrowRight size={13} />
            </span>
          </Link>
        </Reveal>
      )}

      <Reveal>
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl text-ink">From the library</h2>
            <Link href="/explore" className="btn-ghost text-sm">
              Explore all <ArrowRight size={13} />
            </Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {highlights.map((it) => (
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
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  colorClass,
  tintClass,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  colorClass: string;
  tintClass: string;
}) {
  return (
    <div className={`rounded-panel px-3 py-6 text-center sm:px-4 ${tintClass}`}>
      <Icon size={20} className={`mx-auto ${colorClass}`} />
      <div className={`mt-2 font-display text-4xl ${colorClass}`}>{value}</div>
      <div className="mt-1.5 font-body text-[11px] leading-tight text-ink/55 sm:text-xs">{label}</div>
    </div>
  );
}
