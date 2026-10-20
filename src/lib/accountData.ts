// Everything NextStamp stores about one person, in one object: the data-access copy a person
// is entitled to, and the exact list the delete action removes.
import { prisma } from "./prisma";

export async function exportAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      heldDocuments: true,
      entitlement: true,
      tripImports: true,
      trips: { include: { packingItems: true, expenses: true, savedPlaces: true, collaborators: { include: { user: { select: { name: true } } } } } },
      tripCollaborations: { include: { trip: { select: { id: true, title: true } } } },
    },
  });
  if (!user) return null;
  const funds = await prisma.tripFund.findMany({ where: { userId }, include: { entries: true } });
  const waitlist = await prisma.waitlistSignup.findMany({ where: { email: user.email } });
  return {
    exportedAt: new Date().toISOString(),
    note: "Everything NextStamp holds about this account. Payment card details are held by Stripe, not by NextStamp.",
    account: { id: user.id, email: user.email, name: user.name, passportCountry: user.passportCountry, passportExpiry: user.passportExpiry, createdAt: user.createdAt },
    heldDocuments: user.heldDocuments,
    purchase: user.entitlement
      ? {
          status: user.entitlement.status, source: user.entitlement.source, amountMinor: user.entitlement.amountMinor, currency: user.entitlement.currency,
          trialEnd: user.entitlement.trialEnd, currentPeriodEnd: user.entitlement.currentPeriodEnd, cancelAtPeriodEnd: user.entitlement.cancelAtPeriodEnd,
          createdAt: user.entitlement.createdAt,
        }
      : null,
    trips: user.trips.map((t) => ({ ...t, shareToken: undefined, publicToken: undefined, collaborators: t.collaborators.map((c) => ({ name: c.user.name, joinedAt: c.createdAt })) })),
    tripsYouJoined: user.tripCollaborations.map((c) => ({ tripId: c.trip.id, title: c.trip.title, joinedAt: c.createdAt })),
    tripFunds: funds,
    tripImports: user.tripImports,
    waitlistSignups: waitlist,
  };
}

/** Deletes the person's rows. Cascades remove trips, documents, expenses they paid, imports and the purchase record. */
export async function deleteAccountData(userId: string, email: string) {
  await prisma.tripFund.deleteMany({ where: { userId } });
  await prisma.waitlistSignup.deleteMany({ where: { email } });
  await prisma.user.delete({ where: { id: userId } });
}
