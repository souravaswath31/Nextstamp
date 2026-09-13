import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { getCascadeExplorer } from "@/lib/visa";
import { getExpiryStatus, isUrgent, EXPIRY_SEVERITY_CLASSES } from "@/lib/documents";
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

      {upcomingDocuments.length > 0 && (
        <Reveal>
          <section>
            <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
              <AlertOctagon size={20} className="text-stampRed" /> Coming up
            </h2>
            <div className="mt-4 space-y-3">
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
                  className="card-lift flex items-center justify-between rounded-panel bg-paper px-5 py-4 shadow-paper"
                >
                  <span className="font-display text-base text-ink">{trip.title}</span>
                  <StatusPill status={trip.status as TripStatus} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </Reveal>

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
