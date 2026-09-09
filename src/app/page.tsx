import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { getCascadeExplorer } from "@/lib/visa";
import { getExpiryStatus, isUrgent, EXPIRY_SEVERITY_CLASSES } from "@/lib/documents";
import ItineraryCard from "@/components/ItineraryCard";
import StatusPill from "@/components/StatusPill";
import type { TripStatus } from "@/lib/types";

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

  const countriesVisited = new Set(
    completedTrips.flatMap((t) => {
      // best-effort: we don't join itinerary countries into the trip record,
      // so this counts distinct trip titles as a stand-in until a real
      // country field is worth adding to UserTrip.
      return [t.id];
    })
  ).size;

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
    <div className="space-y-12">
      <section>
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/50">
          {user.homeBaseLocation}
        </p>
        <h1 className="mt-1 font-display text-3xl italic text-ink sm:text-4xl">
          Where to <span className="text-coral">next</span>, {user.name}?
        </h1>
      </section>

      {upcomingDocuments.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-ink">Coming up</h2>
          <div className="mt-3 space-y-2">
            {upcomingDocuments.map(({ doc, expiry, unlocks }) => (
              <div key={doc.id} className={`border border-line border-l-4 px-4 py-3 ${EXPIRY_SEVERITY_CLASSES[expiry.severity]}`}>
                <p className="font-body text-sm font-semibold text-ink">
                  Your {doc.country} {doc.subtype ?? "document"} {expiry.label.toLowerCase()}
                </p>
                {unlocks.length > 0 && (
                  <p className="mt-1 font-body text-xs text-ink/70">
                    This is what unlocks your visa-free or on-arrival access to{" "}
                    {unlocks.map((u) => u.destinationCountry).join(", ")} — renewing it (or noting the
                    lapse) keeps that accurate.
                  </p>
                )}
                <Link href="/profile" className="mt-1 inline-block font-body text-xs text-ink underline">
                  Review in Profile →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-3 divide-x divide-line border border-line">
        <Stat label="Completed trips" value={completedTrips.length} colorClass="text-forest" />
        <Stat label="Completed this year" value={tripsThisYear} colorClass="text-teal" />
        <Stat label="In planning" value={activeTrips.length} colorClass="text-coralDark" />
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-ink">Active trips</h2>
          <Link href="/my-trips" className="font-body text-sm text-ink/60 hover:text-ink">
            View all →
          </Link>
        </div>
        {activeTrips.length === 0 ? (
          <p className="mt-3 font-body text-sm text-ink/60">
            Nothing in planning yet. Browse the library and start one.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {activeTrips.map((trip) => (
              <Link
                key={trip.id}
                href={`/trip/${trip.id}`}
                className="flex items-center justify-between border border-line px-4 py-3 hover:border-ink"
              >
                <span className="font-display text-base text-ink">{trip.title}</span>
                <StatusPill status={trip.status as TripStatus} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-ink">From the library</h2>
          <Link href="/explore" className="font-body text-sm text-ink/60 hover:text-ink">
            Explore all →
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
    </div>
  );
}

function Stat({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="px-4 py-4 text-center">
      <div className={`font-display text-3xl ${colorClass}`}>{value}</div>
      <div className="mt-1 font-body text-xs text-ink/60">{label}</div>
    </div>
  );
}
