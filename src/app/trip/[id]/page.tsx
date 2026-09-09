import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TripEditor from "@/components/TripEditor";
import type { TripDay, TripStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TripPage({ params }: { params: { id: string } }) {
  const trip = await prisma.userTrip.findUnique({ where: { id: params.id } });
  if (!trip) notFound();

  // Defend against a corrupted or hand-edited customDaysJson value — a
  // parse failure here would otherwise take down the whole page instead
  // of just this one trip.
  let days: TripDay[] = [];
  let corrupted = false;
  try {
    const parsed = JSON.parse(trip.customDaysJson);
    days = Array.isArray(parsed) ? parsed : [];
    if (!Array.isArray(parsed)) corrupted = true;
  } catch {
    corrupted = true;
  }

  return (
    <div className="space-y-4">
      {corrupted && (
        <p className="border border-stampRed/40 bg-stampRed/5 px-4 py-3 font-body text-sm text-stampRed">
          This trip's day-by-day plan couldn't be read and was reset to empty — sorry about that.
          Everything else (title, status, budget tier) is intact. Rebuild the days below and save.
        </p>
      )}
      <TripEditor
        tripId={trip.id}
        initialTitle={trip.title}
        initialStatus={trip.status as TripStatus}
        initialCostTier={trip.costTier}
        initialDays={days}
      />
    </div>
  );
}
