import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { createBlankTrip } from "@/lib/actions";
import StatusPill from "@/components/StatusPill";
import { TRIP_STATUSES, type TripStatus } from "@/lib/types";
import { Plus, CalendarRange, MapPin, AlertTriangle, Globe } from "lucide-react";
import { buildReadinessReport } from "@/lib/readiness";

export const dynamic = "force-dynamic";

function formatRange(start: Date | null, end: Date | null): string | null {
  if (!start) return null;
  const long: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  };
  if (!end) return start.toLocaleDateString("en-US", long);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const startOpts: Intl.DateTimeFormatOptions = sameYear
    ? { month: "short", day: "numeric", timeZone: "UTC" }
    : long;
  return `${start.toLocaleDateString("en-US", startOpts)} – ${end.toLocaleDateString("en-US", long)}`;
}

export default async function MyTripsPage() {
  const user = await getCurrentUser();
  const trips = await prisma.userTrip.findMany({
    where: {
      OR: [{ userId: user.id }, { collaborators: { some: { userId: user.id } } }],
    },
    include: { user: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  // Readiness per trip, so a blocker shows up in the list rather than only
  // once you've opened the trip. Only for trips that aren't already over —
  // there's nothing actionable about a passport rule on a finished trip.
  const readiness = new Map<string, number>();
  await Promise.all(
    trips
      .filter((t) => t.status !== "completed" && t.destinationCountry && t.startDate)
      .map(async (t) => {
        const report = await buildReadinessReport(user, t);
        const blockers = report.checks.filter((c) => c.state === "blocked").length;
        if (blockers > 0) readiness.set(t.id, blockers);
      })
  );

  const byStatus = TRIP_STATUSES.map((status) => ({
    status,
    trips: trips.filter((t) => t.status === status),
  }));

  const today = new Date();

  return (
    <div className="space-y-10">
      <div className="text-center sm:text-left">
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/45">
          Trip tracker
        </p>
        <h1 className="mt-2 font-display text-5xl tracking-tightest text-ink sm:text-6xl">My Trips</h1>
      </div>

      <form action={createBlankTrip} className="flex gap-2 rounded-panel bg-paper p-3 shadow-paper">
        <input
          id="new-trip-title"
          name="title"
          placeholder="Start a trip from scratch..."
          className="flex-1 rounded-card bg-paperDark px-4 py-2.5 font-body text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
        />
        <button type="submit" className="btn-pill btn-pill-primary !px-5">
          <Plus size={15} /> Create
        </button>
      </form>

      {trips.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-panel bg-paper py-10 text-center shadow-paper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/illustration-empty-trips.jpg" alt="" className="h-32 w-auto" />
          <p className="font-body text-sm text-ink/55">
            No trips yet. Start one above, or find one in{" "}
            <Link href="/explore" className="text-coral underline">
              Explore
            </Link>
            .
          </p>
        </div>
      )}

      {byStatus.map(
        ({ status, trips }) =>
          trips.length > 0 && (
            <section key={status}>
              <h2 className="font-display text-xl capitalize text-ink">{status}</h2>
              <div className="mt-4 space-y-3">
                {trips.map((trip) => {
                  const range = formatRange(trip.startDate, trip.endDate);
                  const blockers = readiness.get(trip.id);
                  const daysAway =
                    trip.startDate && status !== "completed"
                      ? Math.round(
                          (Date.UTC(
                            trip.startDate.getUTCFullYear(),
                            trip.startDate.getUTCMonth(),
                            trip.startDate.getUTCDate()
                          ) -
                            Date.UTC(
                              today.getUTCFullYear(),
                              today.getUTCMonth(),
                              today.getUTCDate()
                            )) /
                            86_400_000
                        )
                      : null;
                  return (
                    <Link
                      key={trip.id}
                      href={`/trip/${trip.id}`}
                      className="card-lift flex flex-wrap items-center justify-between gap-3 rounded-panel bg-paper px-5 py-4 shadow-paper"
                    >
                      <div className="min-w-0">
                        <span className="font-display text-base text-ink">{trip.title}</span>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                          {trip.destinationCountry && (
                            <span className="flex items-center gap-1 font-body text-xs text-ink/55">
                              <MapPin size={11} className="text-ink/30" /> {trip.destinationCountry}
                            </span>
                          )}
                          {range && (
                            <span className="flex items-center gap-1 font-body text-xs text-ink/55">
                              <CalendarRange size={11} className="text-ink/30" /> {range}
                            </span>
                          )}
                          {daysAway !== null && daysAway >= 0 && (
                            <span className="font-body text-xs font-semibold text-teal">
                              {daysAway === 0 ? "Today" : `in ${daysAway} day${daysAway === 1 ? "" : "s"}`}
                            </span>
                          )}
                          {trip.isPublic && (
                            <span className="flex items-center gap-1 font-body text-xs text-ink/40">
                              <Globe size={11} /> Public link
                            </span>
                          )}
                        </div>
                        {trip.userId !== user.id && (
                          <p className="mt-1 font-body text-xs text-ink/45">
                            Shared by {trip.user.name}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {blockers && (
                          <span className="flex items-center gap-1 rounded-full bg-stampRed/10 px-2.5 py-1 font-body text-[11px] font-semibold text-stampRed">
                            <AlertTriangle size={11} />
                            {blockers} blocker{blockers === 1 ? "" : "s"}
                          </span>
                        )}
                        <StatusPill status={trip.status as TripStatus} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )
      )}
    </div>
  );
}
