import type Stripe from "stripe";
import { PRODUCT_TAG, sessionToGrant, type Grant } from "./entitlement";

export type WebhookDeps = {
  grant: (g: Grant) => Promise<void>;
  revoke: (paymentIntentId: string) => Promise<number>;
  /** Turns access back on after a dispute is won. Optional so older callers and tests still type-check. */
  restore?: (paymentIntentId: string) => Promise<number>;
};

export type WebhookOutcome = "granted" | "revoked" | "restored" | "ignored";

/**
 * What each Stripe event does to an entitlement. Signature verification happens
 * before this (in the route), so by here the event is genuinely Stripe's.
 *
 * - checkout.session.completed / async_payment_succeeded: grant, if the session
 *   is a paid one of ours naming a user. (completed can arrive with the payment
 *   still pending for delayed methods; sessionToGrant refuses those and the
 *   async event grants later.)
 * - charge.refunded (fully refunded) and charge.dispute.created: switch access
 *   off for that payment. charge.dispute.closed with status "won" switches it back on.
 * Everything else is acknowledged and ignored, so Stripe never retries it.
 */
export async function handleStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<WebhookOutcome> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const grant = sessionToGrant(event.data.object as Stripe.Checkout.Session);
      if (!grant) return "ignored";
      await deps.grant(grant);
      return "granted";
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      if (!charge.refunded || !charge.payment_intent) return "ignored"; // partial refunds keep access
      if (charge.metadata?.product && charge.metadata.product !== PRODUCT_TAG) return "ignored";
      const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent.id;
      return (await deps.revoke(pi)) > 0 ? "revoked" : "ignored";
    }
    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const pi = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
      if (!pi) return "ignored";
      return (await deps.revoke(pi)) > 0 ? "revoked" : "ignored";
    }
    case "charge.dispute.closed": {
      // Only a dispute we WON gives access back; a lost one stays revoked.
      const dispute = event.data.object as Stripe.Dispute;
      if (dispute.status !== "won" || !deps.restore) return "ignored";
      const pi = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
      if (!pi) return "ignored";
      return (await deps.restore(pi)) > 0 ? "restored" : "ignored";
    }
    default:
      return "ignored";
  }
}
