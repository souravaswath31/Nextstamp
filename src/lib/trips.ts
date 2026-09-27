import { prisma } from "./prisma";

// Central place for "can this user touch this trip" — a trip is editable by
// its owner or by anyone who joined via the shareToken invite link
// (TripCollaborator). Every trip-mutating action and the trip page itself
// route through this instead of trusting a bare tripId, closing the gap
// where any signed-in user could previously read or edit any trip by ID.
export async function getTripWithAccess(tripId: string, userId: string) {
  const trip = await prisma.userTrip.findUnique({
    where: { id: tripId },
    include: {
      collaborators: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!trip) return { trip: null, isOwner: false, canEdit: false } as const;

  const isOwner = trip.userId === userId;
  const isCollaborator = trip.collaborators.some((c) => c.userId === userId);

  return { trip, isOwner, canEdit: isOwner || isCollaborator } as const;
}
