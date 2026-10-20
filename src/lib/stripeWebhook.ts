import type Stripe from "stripe";
import { PRODUCT_TAG, subscriptionToRecord, type SubscriptionRecord } from "./entitlement";

export type WebhookDeps = {
  /** Mirror a subscription into the entitlement. */
  save: (r: SubscriptionRecord) => Promise<void>;
  /** Switch access off for a Stripe customer (refund or dispute). Returns rows changed. */
  revoke: (customerId: string) => Promise<number>;
  /** Turn it back on after a dispute is won. Optional so older callers and tests still type-check. */
  restore?: (customerId: string) => Promise<number>;
  /** Which customer paid a payment intent (disputes do not carry the customer). */
  customerOfPaymentIntent?: (paymentIntentId: string) => Promise<string | null>;
  /** Best effort: stop a refunded customer being billed again. */
  cancelForCustomer?: (customerId: string) => Promise<void>;
};

export type WebhookOutcome = "synced" | "revoked" | "restored" | "ignored";

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : v?.id ?? null);

/**
 * What each Stripe event does to an entitlement. Signature verification happens before this (in the route),
 * so by here the event is genuinely Stripe's. Stripe is the source of truth for the subscription:
 *
 * - customer.subscription.created / updated / deleted: mirror the subscription (trialing, active, past_due,
 *   canceled...) if it is one of ours. A deleted event always records "canceled".
 * - charge.refunded (fully refunded): access off, and the customer's subscription is cancelled so a refund is
 *   never followed by another charge. Partial refunds keep access.
 * - charge.dispute.created: access off. charge.dispute.closed with status "won": access back.
 * Everything else, including checkout.session.completed (the subscription events carry the same facts with
 * the user id), is acknowledged and ignored so Stripe never retries it.
 */
export async function handleStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<WebhookOutcome> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const rec = subscriptionToRecord(event.data.object as unknown as Parameters<typeof subscriptionToRecord>[0]);
      if (!rec) return "ignored";
      await deps.save(event.type === "customer.subscription.deleted" ? { ...rec, status: "canceled" } : rec);
      return "synced";
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      if (!charge.refunded) return "ignored"; // partial refunds keep access
      if (charge.metadata?.product && charge.metadata.product !== PRODUCT_TAG) return "ignored";
      const customer = idOf(charge.customer);
      if (!customer) return "ignored";
      const changed = await deps.revoke(customer);
      if (changed > 0) await deps.cancelForCustomer?.(customer);
      return changed > 0 ? "revoked" : "ignored";
    }
    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const pi = idOf(dispute.payment_intent as string | { id: string } | null);
      const customer = pi && deps.customerOfPaymentIntent ? await deps.customerOfPaymentIntent(pi) : null;
      if (!customer) return "ignored";
      const changed = await deps.revoke(customer);
      if (changed > 0) await deps.cancelForCustomer?.(customer);
      return changed > 0 ? "revoked" : "ignored";
    }
    case "charge.dispute.closed": {
      // Only a dispute we WON gives access back; a lost one stays revoked.
      const dispute = event.data.object as Stripe.Dispute;
      if (dispute.status !== "won" || !deps.restore || !deps.customerOfPaymentIntent) return "ignored";
      const pi = idOf(dispute.payment_intent as string | { id: string } | null);
      const customer = pi ? await deps.customerOfPaymentIntent(pi) : null;
      if (!customer) return "ignored";
      return (await deps.restore(customer)) > 0 ? "restored" : "ignored";
    }
    default:
      return "ignored";
  }
}
