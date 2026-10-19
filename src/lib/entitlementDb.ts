import { prisma } from "./prisma";
import { computeAccess, paymentsConfigured, type Grant } from "./entitlement";

/** Idempotent: the same session (or a second purchase attempt) never creates a second row. */
export async function grantEntitlement(g: Grant): Promise<void> {
  const existing = await prisma.entitlement.findUnique({ where: { userId: g.userId } });
  if (existing) {
    // A second paid session for someone who already has access is a double payment. It is not granted
    // twice; it is logged so a person can refund it in Stripe.
    if (existing.status === "active" && existing.stripeSessionId && existing.stripeSessionId !== g.sessionId) {
      console.warn("[entitlement] second payment for an active user; refund it in Stripe", g.userId, g.sessionId);
    }
    // A refunded user buying again gets access back; an active one is left alone.
    if (existing.status === "refunded") {
      await prisma.entitlement.update({
        where: { userId: g.userId },
        data: {
          status: "active", source: "stripe", stripeSessionId: g.sessionId,
          stripePaymentIntentId: g.paymentIntentId, amountMinor: g.amountMinor, currency: g.currency,
        },
      });
    }
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: g.userId }, select: { id: true } });
  if (!user) return; // A payment for a user we don't have: leave it for a human, don't invent an account.
  await prisma.entitlement.create({
    data: {
      userId: g.userId, source: "stripe", stripeSessionId: g.sessionId,
      stripePaymentIntentId: g.paymentIntentId, amountMinor: g.amountMinor, currency: g.currency,
    },
  });
}

export async function revokeByPaymentIntent(paymentIntentId: string): Promise<number> {
  const r = await prisma.entitlement.updateMany({
    where: { stripePaymentIntentId: paymentIntentId, status: "active" },
    data: { status: "refunded" },
  });
  return r.count;
}

/** A dispute that was decided in our favour: the payment stands, so access comes back. */
export async function restoreByPaymentIntent(paymentIntentId: string): Promise<number> {
  const r = await prisma.entitlement.updateMany({
    where: { stripePaymentIntentId: paymentIntentId, status: "refunded", source: "stripe" },
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
