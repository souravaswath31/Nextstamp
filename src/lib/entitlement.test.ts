import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import {
  ACCESS_STATUSES, PRICE_LABEL, PRICE_MINOR, PRODUCT_TAG, REFUND_DAYS, TRIAL_DAYS,
  computeAccess, describeSubscription, isFeatureKey, paymentsConfigured, subscriptionToRecord,
} from "./entitlement";
import { handleStripeEvent, type WebhookDeps } from "./stripeWebhook";

const created = new Date("2026-06-01T00:00:00Z");
const ent = (status: string, source = "stripe") => ({ configured: true, entitlement: { status, source }, userCreatedAt: created });

describe("the offer", () => {
  it("is a 30-day trial, then $39 a year, with a 14-day refund", () => {
    expect(PRICE_MINOR).toBe(3900);
    expect(PRICE_LABEL).toBe("$39 a year");
    expect(TRIAL_DAYS).toBe(30);
    expect(REFUND_DAYS).toBe(14);
  });
});

describe("computeAccess", () => {
  it("gives everyone full access while payment isn't configured", () => {
    expect(computeAccess({ configured: false, entitlement: null, userCreatedAt: created })).toBe(true);
  });
  it("closes the gate once configured, for people with no plan", () => {
    expect(computeAccess({ configured: true, entitlement: null, userCreatedAt: created })).toBe(false);
  });
  it("keeps access while trialing, active, or past_due (Stripe is retrying the card)", () => {
    for (const s of ACCESS_STATUSES) expect(computeAccess(ent(s))).toBe(true);
    expect(computeAccess(ent("active", "grant"))).toBe(true);
  });
  it("ends access when cancelled, refunded, unpaid or never completed", () => {
    for (const s of ["canceled", "refunded", "unpaid", "incomplete", "incomplete_expired", "paused"]) expect(computeAccess(ent(s))).toBe(false);
  });
  it("still honours the optional grandfather date, and only for accounts before it", () => {
    const g = "2027-01-01";
    expect(computeAccess({ configured: true, entitlement: null, userCreatedAt: created, grandfatherBefore: g })).toBe(true);
    expect(computeAccess({ configured: true, entitlement: null, userCreatedAt: new Date("2027-02-01"), grandfatherBefore: g })).toBe(false);
    expect(computeAccess({ configured: true, entitlement: null, userCreatedAt: created, grandfatherBefore: "garbage" })).toBe(false);
  });
  it("needs both Stripe keys to count as configured", () => {
    expect(paymentsConfigured({})).toBe(false);
    expect(paymentsConfigured({ STRIPE_SECRET_KEY: "sk_test_x" })).toBe(false);
    expect(paymentsConfigured({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x" })).toBe(true);
  });
  it("knows its feature keys", () => {
    expect(isFeatureKey("trips")).toBe(true);
    expect(isFeatureKey("toString")).toBe(false);
    expect(isFeatureKey(null)).toBe(false);
  });
});

const sub = {
  id: "sub_1", status: "trialing", customer: "cus_1", metadata: { product: PRODUCT_TAG, userId: "user_abcdef12" },
  trial_end: 1_795_000_000, current_period_end: 1_795_000_000, cancel_at_period_end: false,
  items: { data: [{ price: { unit_amount: 3900, currency: "usd" } }] },
};

describe("subscriptionToRecord", () => {
  it("mirrors a subscription of ours", () => {
    const r = subscriptionToRecord(sub)!;
    expect(r).toMatchObject({ userId: "user_abcdef12", subscriptionId: "sub_1", customerId: "cus_1", status: "trialing", cancelAtPeriodEnd: false, amountMinor: 3900, currency: "usd" });
    expect(r.trialEnd?.getTime()).toBe(1_795_000_000_000);
    expect(r.currentPeriodEnd?.getTime()).toBe(1_795_000_000_000);
  });
  it("reads the period end from the item on newer Stripe API versions, and a customer object", () => {
    const r = subscriptionToRecord({ ...sub, current_period_end: undefined, customer: { id: "cus_2" }, items: { data: [{ current_period_end: 1_800_000_000, price: { unit_amount: 3900, currency: "usd" } }] } })!;
    expect(r.currentPeriodEnd?.getTime()).toBe(1_800_000_000_000);
    expect(r.customerId).toBe("cus_2");
  });
  it("refuses foreign, anonymous and malformed subscriptions", () => {
    expect(subscriptionToRecord({ ...sub, metadata: { product: "something-else", userId: "user_abcdef12" } })).toBeNull();
    expect(subscriptionToRecord({ ...sub, metadata: null })).toBeNull();
    expect(subscriptionToRecord({ ...sub, metadata: { product: PRODUCT_TAG } })).toBeNull();
    expect(subscriptionToRecord({ ...sub, metadata: { product: PRODUCT_TAG, userId: "x'; DROP" } })).toBeNull();
    expect(subscriptionToRecord({ ...sub, status: null })).toBeNull();
  });
});

describe("describeSubscription", () => {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date("2026-11-20T00:00:00Z");
  it("says what happens next, plainly", () => {
    expect(describeSubscription({ status: "trialing", trialEnd: end, currentPeriodEnd: end, cancelAtPeriodEnd: false }, fmt)).toContain("2026-11-20");
    expect(describeSubscription({ status: "trialing", trialEnd: end, currentPeriodEnd: end, cancelAtPeriodEnd: true }, fmt)).toContain("will not be charged");
    expect(describeSubscription({ status: "active", trialEnd: null, currentPeriodEnd: end, cancelAtPeriodEnd: false }, fmt)).toContain("Renews 2026-11-20 at $39 a year");
    expect(describeSubscription({ status: "active", trialEnd: null, currentPeriodEnd: end, cancelAtPeriodEnd: true }, fmt)).toContain("will not renew");
    expect(describeSubscription({ status: "past_due", trialEnd: null, currentPeriodEnd: end, cancelAtPeriodEnd: false }, fmt)).toContain("did not go through");
    expect(describeSubscription({ status: "refunded", trialEnd: null, currentPeriodEnd: null, cancelAtPeriodEnd: false }, fmt)).toContain("refunded");
  });
});

function deps() {
  const calls: string[] = [];
  const d: WebhookDeps = {
    save: async (r) => { calls.push(`save:${r.userId}:${r.status}`); },
    revoke: async (c) => { calls.push(`revoke:${c}`); return c === "cus_known" ? 1 : 0; },
    restore: async (c) => { calls.push(`restore:${c}`); return c === "cus_known" ? 1 : 0; },
    customerOfPaymentIntent: async (pi) => (pi === "pi_known" ? "cus_known" : pi === "pi_stranger" ? "cus_unknown" : null),
    cancelForCustomer: async (c) => { calls.push(`cancel:${c}`); },
  };
  return { d, calls };
}
const ev = (type: string, object: unknown) => ({ id: "evt_1", type, data: { object } }) as unknown as Stripe.Event;

describe("handleStripeEvent", () => {
  it("mirrors subscription created and updated events, and records canceled on deleted", async () => {
    const { d, calls } = deps();
    expect(await handleStripeEvent(ev("customer.subscription.created", sub), d)).toBe("synced");
    expect(await handleStripeEvent(ev("customer.subscription.updated", { ...sub, status: "active" }), d)).toBe("synced");
    expect(await handleStripeEvent(ev("customer.subscription.deleted", { ...sub, status: "active" }), d)).toBe("synced");
    expect(calls).toEqual(["save:user_abcdef12:trialing", "save:user_abcdef12:active", "save:user_abcdef12:canceled"]);
  });
  it("ignores another product's subscriptions on the same Stripe account", async () => {
    const { d, calls } = deps();
    expect(await handleStripeEvent(ev("customer.subscription.created", { ...sub, metadata: { product: "other", userId: "user_abcdef12" } }), d)).toBe("ignored");
    expect(calls).toEqual([]);
  });
  it("revokes on a full refund and cancels the subscription, but keeps access on a partial refund", async () => {
    const { d, calls } = deps();
    expect(await handleStripeEvent(ev("charge.refunded", { refunded: true, customer: "cus_known", metadata: {} }), d)).toBe("revoked");
    expect(await handleStripeEvent(ev("charge.refunded", { refunded: false, customer: "cus_known" }), d)).toBe("ignored");
    expect(await handleStripeEvent(ev("charge.refunded", { refunded: true, customer: "cus_unknown" }), d)).toBe("ignored");
    expect(await handleStripeEvent(ev("charge.refunded", { refunded: true, customer: "cus_known", metadata: { product: "other" } }), d)).toBe("ignored");
    expect(await handleStripeEvent(ev("charge.refunded", { refunded: true, customer: null }), d)).toBe("ignored");
    expect(calls).toEqual(["revoke:cus_known", "cancel:cus_known", "revoke:cus_unknown"]);
  });
  it("revokes on a dispute, finding the customer from the payment", async () => {
    const { d, calls } = deps();
    expect(await handleStripeEvent(ev("charge.dispute.created", { payment_intent: "pi_known" }), d)).toBe("revoked");
    expect(await handleStripeEvent(ev("charge.dispute.created", { payment_intent: "pi_stranger" }), d)).toBe("ignored");
    expect(await handleStripeEvent(ev("charge.dispute.created", { payment_intent: null }), d)).toBe("ignored");
    expect(calls).toEqual(["revoke:cus_known", "cancel:cus_known", "revoke:cus_unknown"]);
  });
  it("restores access only when a dispute is won", async () => {
    const { d, calls } = deps();
    expect(await handleStripeEvent(ev("charge.dispute.closed", { status: "won", payment_intent: "pi_known" }), d)).toBe("restored");
    expect(await handleStripeEvent(ev("charge.dispute.closed", { status: "lost", payment_intent: "pi_known" }), d)).toBe("ignored");
    expect(await handleStripeEvent(ev("charge.dispute.closed", { status: "won", payment_intent: "pi_stranger" }), d)).toBe("ignored");
    expect(calls).toEqual(["restore:cus_known", "restore:cus_unknown"]);
  });
  it("acknowledges and ignores everything else, including checkout.session.completed", async () => {
    const { d, calls } = deps();
    expect(await handleStripeEvent(ev("customer.created", {}), d)).toBe("ignored");
    expect(await handleStripeEvent(ev("checkout.session.completed", { id: "cs_1", mode: "subscription" }), d)).toBe("ignored");
    expect(calls).toEqual([]);
  });
});

describe("webhook signatures", () => {
  const secret = "whsec_test_secret";
  const stripe = new Stripe("sk_test_dummy");
  const payload = JSON.stringify({ id: "evt_1", object: "event", type: "customer.subscription.created", data: { object: sub } });

  it("accepts a correctly signed payload and rejects a tampered or wrongly signed one", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(stripe.webhooks.constructEvent(payload, header, secret).type).toBe("customer.subscription.created");
    expect(() => stripe.webhooks.constructEvent(payload.replace("user_abcdef12", "user_attacker"), header, secret)).toThrow();
    expect(() => stripe.webhooks.constructEvent(payload, stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_other" }), secret)).toThrow();
    expect(() => stripe.webhooks.constructEvent(payload, "t=1,v1=abc", secret)).toThrow();
  });
});
