import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { createBlankTrip } from "@/lib/actions";
import StatusPill from "@/components/StatusPill";
import { TRIP_STATUSES, type TripStatus } from "@/lib/types";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MyTripsPage() {
  const user = await getCurrentUser();
  const trips = await prisma.userTrip.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  const byStatus = TRIP_STATUSES.map((status) => ({
    status,
    trips: trips.filter((t) => t.status === status),
  }));

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
          name="title"
          placeholder="Start a trip from scratch..."
          className="flex-1 rounded-card bg-paperDark px-4 py-2.5 font-body text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
        />
        <button type="submit" className="btn-pill btn-pill-primary !px-5">
          <Plus size={15} /> Create
        </button>
      </form>

      {trips.length === 0 && (
        <p className="font-body text-sm text-ink/55">
          No trips yet. Start one above, or find one in{" "}
          <Link href="/explore" className="text-coral underline">
            Explore
          </Link>
          .
        </p>
      )}

      {byStatus.map(
        ({ status, trips }) =>
          trips.length > 0 && (
            <section key={status}>
              <h2 className="font-display text-xl capitalize text-ink">{status}</h2>
              <div className="mt-4 space-y-3">
                {trips.map((trip) => (
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
            </section>
          )
      )}
    </div>
  );
}
