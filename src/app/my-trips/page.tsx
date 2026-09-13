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
    <div className="space-y-8">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="font-stamp text-xs uppercase tracking-widest text-ink/50">
            Trip tracker
          </p>
          <h1 className="mt-1 font-display text-3xl text-ink">My Trips</h1>
        </div>
      </div>

      <form action={createBlankTrip} className="flex gap-2 border border-line bg-paper p-3 shadow-paper">
        <input
          name="title"
          placeholder="Start a trip from scratch..."
          className="flex-1 border border-line bg-paper px-3 py-2 font-body text-sm text-ink placeholder:text-ink/40 focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-full border border-coral px-4 py-2 font-body text-sm font-medium text-coralDark transition-colors hover:bg-coral hover:text-white"
        >
          <Plus size={15} /> Create
        </button>
      </form>

      {trips.length === 0 && (
        <p className="font-body text-sm text-ink/60">
          No trips yet. Start one above, or find one in{" "}
          <Link href="/explore" className="underline">
            Explore
          </Link>
          .
        </p>
      )}

      {byStatus.map(
        ({ status, trips }) =>
          trips.length > 0 && (
            <section key={status}>
              <h2 className="font-display text-lg capitalize text-ink">{status}</h2>
              <div className="mt-3 space-y-2">
                {trips.map((trip) => (
                  <Link
                    key={trip.id}
                    href={`/trip/${trip.id}`}
                    className="card-lift flex items-center justify-between border border-line bg-paper px-4 py-3 hover:border-ink"
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
