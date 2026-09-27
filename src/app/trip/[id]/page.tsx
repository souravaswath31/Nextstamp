import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { getTripWithAccess } from "@/lib/trips";
import TripEditor from "@/components/TripEditor";
import type { TripDay, TripStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TripPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const { trip, isOwner, canEdit } = await getTripWithAccess(params.id, user.id);

  // Not found (rather than a 403) for both a missing trip and one this user
  // has no access to — a real trip ID with editing enforced but *readable*
  // to a wrong guesser would still leak that the ID exists.
  if (!trip || !canEdit) notFound();

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
        <p className="rounded-panel bg-stampRed/5 px-5 py-4 font-body text-sm text-stampRed">
          This trip's day-by-day plan couldn't be read and was reset to empty — sorry about that.
          Everything else (title, status, budget tier) is intact. Rebuild the days below and save.
        </p>
      )}
      {!isOwner && (
        <p className="rounded-panel bg-teal/5 px-5 py-4 font-body text-sm text-ink/70">
          Shared with you by {trip.user.name} — you can edit the day plan, but only they can
          delete the trip or remove co-travelers.
        </p>
      )}
      <TripEditor
        // Remounts (resetting all local editor state to fresh server data)
        // whenever the row actually changes — the mechanism the Realtime
        // "refresh to see the latest" banner relies on, since router.refresh()
        // alone wouldn't reset state a client component already holds.
        key={trip.updatedAt.getTime()}
        tripId={trip.id}
        initialTitle={trip.title}
        initialStatus={trip.status as TripStatus}
        initialCostTier={trip.costTier}
        initialDays={days}
        isOwner={isOwner}
        shareToken={trip.shareToken}
        collaborators={trip.collaborators.map((c) => ({
          userId: c.userId,
          name: c.user.name,
          email: c.user.email,
        }))}
      />
    </div>
  );
}
