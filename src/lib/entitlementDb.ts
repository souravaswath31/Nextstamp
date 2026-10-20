import { prisma } from "./prisma";
import { computeAccess, paymentsConfigured, type SubscriptionRecord } from "./entitlement";

/**
 * Mirrors a Stripe subscription into the person's entitlement. Idempotent: the same event twice changes nothing.
 * A manual grant is never overwritten by Stripe, and a subscription that was refunded stays refunded even if a late
 * "active" event arrives for it; a brand new subscription (they came back) is allowed through.
 */
export async function saveSubscription(rec: SubscriptionRecord): Promise<void> {
  const existing = await prisma.entitlement.findUnique({ where: { userId: rec.userId } });
  if (existing?.source === "grant") return;
  if (existing?.status === "refunded" && existing.stripeSubscriptionId === rec.subscriptionId) return;
  const user = await prisma.user.findUnique({ where: { id: rec.userId }, select: { id: true } });
  if (!user) return; // A payment for a user we don't have: leave it for a human, don't invent an account.
  const data = {
    source: "stripe",
    status: rec.status,
    stripeCustomerId: rec.customerId,
    stripeSubscriptionId: rec.subscriptionId,
    trialEnd: rec.trialEnd,
    currentPeriodEnd: rec.currentPeriodEnd,
    cancelAtPeriodEnd: rec.cancelAtPeriodEnd,
    amountMinor: rec.amountMinor,
    currency: rec.currency,
  };
  if (existing && existing.status === "active" && rec.status === "active" && existing.stripeSubscriptionId && existing.stripeSubscriptionId !== rec.subscriptionId) {
    // A second paid subscription for someone who already has one: logged so a person can refund the extra one.
    console.warn("[entitlement] second active subscription for a user; cancel and refund one in Stripe", rec.userId, rec.subscriptionId);
  }
  await prisma.entitlement.upsert({ where: { userId: rec.userId }, create: { userId: rec.userId, ...data }, update: data });
}

/** A full refund or a dispute: switch access off for the customer's entitlement. */
export async function revokeByCustomer(customerId: string): Promise<number> {
  const r = await prisma.entitlement.updateMany({
    where: { stripeCustomerId: customerId, source: "stripe", NOT: { status: "refunded" } },
    data: { status: "refunded" },
  });
  return r.count;
}

/** A dispute that was decided in our favour: the payment stands, so access comes back until the next subscription event says otherwise. */
export async function restoreByCustomer(customerId: string): Promise<number> {
  const r = await prisma.entitlement.updateMany({
    where: { stripeCustomerId: customerId, status: "refunded", source: "stripe" },
    data: { status: "active" },
  });
  return r.count;
}

export async function userHasFullAccess(userId: string): Promise<boolean> {
  const configured = paymentsConfigured();
  if (!configured) return true;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, entitlement: { select: { status: true, source: true } } },
  });
  if (!u) return false;
  return computeAccess({
    configured, entitlement: u.entitlement, userCreatedAt: u.createdAt,
    grandfatherBefore: process.env.PAID_GRANDFATHER_BEFORE,
  });
}
