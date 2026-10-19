import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import { PRODUCT_TAG, computeAccess, isFeatureKey, paymentsConfigured, sessionToGrant } from "./entitlement";
import { handleStripeEvent, type WebhookDeps } from "./stripeWebhook";

const created = new Date("2026-06-01T00:00:00Z");

describe("computeAccess", () => {
  it("gives everyone full access while payment isn't configured", () => {
    expect(computeAccess({ configured: false, entitlement: null, userCreatedAt: created })).toBe(true);
  });
  it("closes the gate once configured, for people who haven't paid", () => {
    expect(computeAccess({ configured: true, entitlement: null, userCreatedAt: created })).toBe(false);
    expect(computeAccess({ configured: true, entitlement: { status: "refunded", source: "stripe" }, userCreatedAt: created })).toBe(false);
  });
  it("opens it for an active entitlement, from a purchase or a manual grant", () => {
    expect(computeAccess({ configured: true, entitlement: { status: "active", source: "stripe" }, userCreatedAt: created })).toBe(true);
    expect(computeAccess({ configured: true, entitlement: { status: "active", source: "grant" }, userCreatedAt: created })).toBe(true);
  });
  it("grandfathers accounts created before the cutoff, and only those", () => {
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

const paid = {
  id: "cs_test_1", mode: "payment", payment_status: "paid", client_reference_id: "user_abcdef12",
  payment_intent: "pi_1", amount_total: 500, currency: "usd", metadata: { product: PRODUCT_TAG },
};

describe("sessionToGrant", () => {
  it("grants a paid session of ours", () => {
    expect(sessionToGrant(paid)).toEqual({ userId: "user_abcdef12", sessionId: "cs_test_1", paymentIntentId: "pi_1", amountMinor: 500, currency: "usd" });
    expect(sessionToGrant({ ...paid, payment_intent: { id: "pi_2" } })?.paymentIntentId).toBe("pi_2");
  });
  it("refuses unpaid, foreign, subscription and malformed sessions", () => {
    expect(sessionToGrant({ ...paid, payment_status: "unpaid" })).toBeNull();
    expect(sessionToGrant({ ...paid, metadata: { product: "something-else" } })).toBeNull();
    expect(sessionToGrant({ ...paid, metadata: null })).toBeNull();
    expect(sessionToGrant({ ...paid, mode: "subscription" })).toBeNull();
    expect(sessionToGrant({ ...paid, client_reference_id: null })).toBeNull();
    expect(sessionToGrant({ ...paid, client_reference_id: "x'; DROP" })).toBeNull();
  });
});

function deps() {
  const calls: string[] = [];
  const d: WebhookDeps = {
    grant: async (g) => { calls.push(`grant:${g.userId}`); },
    revoke: async (pi) => { calls.push(`revoke:${pi}`); return pi === "pi_known" ? 1 : 0; },
    restore: async (pi) => { calls.push(`restore:${pi}`); return pi === "pi_known" ? 1 : 0; },
  };
  return { d, calls };
}
const ev = (type: string, object: unknown) => ({ id: "evt_1", type, data: { object } }) as unknown as Stripe.Event;

describe("handleStripeEvent", () => {
  it("grants on a completed paid checkout and on a delayed payment succeeding", async () => {
    for (const type of ["checkout.session.completed", "checkout.session.async_payment_succeeded"]) {
      const { d, calls } = deps();
      expect(await handleStripeEvent(ev(type, paid), d)).toBe("granted");
      expect(calls).toEqual(["grant:user_abcdef12"]);
    }
  });
  it("ignores a completed checkout whose payment is still pending, or isn't ours", async () => {
    const { d, calls } = deps();
    expect(await handleStripeEvent(ev("checkout.session.completed", { ...paid, payment_status: "unpaid" }), d)).toBe("ignored");
    expect(await handleStripeEvent(ev("checkout.session.completed", { ...paid, metadata: {} }), d)).toBe("ignored");
    expect(calls).toEqual([]);
  });
  it("revokes on a full refund or a dispute, but keeps access on a partial refund", async () => {
    const { d, calls } = deps();
    expect(await handleStripeEvent(ev("charge.refunded", { refunded: true, payment_intent: "pi_known", metadata: {} }), d)).toBe("revoked");
    expect(await handleStripeEvent(ev("charge.refunded", { refunded: false, payment_intent: "pi_known" }), d)).toBe("ignored");
    expect(await handleStripeEvent(ev("charge.dispute.created", { payment_intent: "pi_known" }), d)).toBe("revoked");
    expect(await handleStripeEvent(ev("charge.refunded", { refunded: true, payment_intent: "pi_unknown" }), d)).toBe("ignored");
    expect(await handleStripeEvent(ev("charge.refunded", { refunded: true, payment_intent: "pi_known", metadata: { product: "other" } }), d)).toBe("ignored");
    expect(calls).toEqual(["revoke:pi_known", "revoke:pi_known", "revoke:pi_unknown"]);
  });
  it("restores access only when a dispute is won", async () => {
    const { d, calls } = deps();
    expect(await handleStripeEvent(ev("charge.dispute.closed", { status: "won", payment_intent: "pi_known" }), d)).toBe("restored");
    expect(await handleStripeEvent(ev("charge.dispute.closed", { status: "lost", payment_intent: "pi_known" }), d)).toBe("ignored");
    expect(await handleStripeEvent(ev("charge.dispute.closed", { status: "won", payment_intent: "pi_unknown" }), d)).toBe("ignored");
    expect(calls).toEqual(["restore:pi_known", "restore:pi_unknown"]);
  });
  it("acknowledges and ignores everything else", async () => {
    const { d, calls } = deps();
    expect(await handleStripeEvent(ev("customer.created", {}), d)).toBe("ignored");
    expect(calls).toEqual([]);
  });
});

describe("webhook signatures", () => {
  const secret = "whsec_test_secret";
  const stripe = new Stripe("sk_test_dummy");
  const payload = JSON.stringify({ id: "evt_1", object: "event", type: "checkout.session.completed", data: { object: paid } });

  it("accepts a correctly signed payload and rejects a tampered or wrongly signed one", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(stripe.webhooks.constructEvent(payload, header, secret).type).toBe("checkout.session.completed");
    expect(() => stripe.webhooks.constructEvent(payload.replace("user_abcdef12", "user_attacker"), header, secret)).toThrow();
    expect(() => stripe.webhooks.constructEvent(payload, stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_other" }), secret)).toThrow();
    expect(() => stripe.webhooks.constructEvent(payload, "t=1,v1=abc", secret)).toThrow();
  });
});
