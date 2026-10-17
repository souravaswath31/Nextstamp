// Who has paid, and what that unlocks (Phase D). The decisions here are pure so
// they can be tested without Stripe or a database; the database and Stripe
// calls live in entitlementDb.ts and the route handlers.
//
// The rule that matters most: **if payment isn't configured, everyone has full
// access.** Nothing is ever locked behind a purchase nobody can make. The gate
// only closes once Stripe keys are set, and the pricing page says which state
// it is in.

export const PRICE_MINOR = 500;
export const PRICE_CURRENCY = "usd";
export const PRICE_LABEL = "$5";
export const PRODUCT_NAME = "NextStamp full access";
/** Stamped on every checkout session we create, so a webhook can ignore anyone else's sales on the same Stripe account. */
export const PRODUCT_TAG = "nextstamp-full-access";

type Env = Record<string, string | undefined>;

export function paymentsConfigured(env: Env = process.env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
}

export type EntitlementRow = { status: string; source: string } | null;

/**
 * Full access if payments are off, the user has an active entitlement, or they
 * are inside the optional grandfather window (PAID_GRANDFATHER_BEFORE: accounts
 * created before that date keep access, so switching payments on never takes
 * features away from people who signed up for free).
 */
export function computeAccess(input: {
  configured: boolean;
  entitlement: EntitlementRow;
  userCreatedAt: Date;
  grandfatherBefore?: string | null;
}): boolean {
  if (!input.configured) return true;
  if (input.entitlement?.status === "active") return true;
  const g = input.grandfatherBefore ? new Date(input.grandfatherBefore) : null;
  return Boolean(g && !Number.isNaN(g.getTime()) && input.userCreatedAt < g);
}

export type Grant = {
  userId: string;
  sessionId: string;
  paymentIntentId: string | null;
  amountMinor: number | null;
  currency: string | null;
};

type SessionLike = {
  id: string;
  mode?: string | null;
  payment_status?: string | null;
  client_reference_id?: string | null;
  payment_intent?: string | { id: string } | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
};

/** A paid session of ours that names a user, or null. Never grants on an unpaid, foreign or malformed session. */
export function sessionToGrant(s: SessionLike): Grant | null {
  if (s.mode !== "payment" || s.payment_status !== "paid") return null;
  if (s.metadata?.product !== PRODUCT_TAG) return null;
  const userId = s.client_reference_id;
  if (!userId || !/^[A-Za-z0-9_-]{8,64}$/.test(userId)) return null;
  const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
  return {
    userId,
    sessionId: s.id,
    paymentIntentId: pi,
    amountMinor: s.amount_total ?? null,
    currency: s.currency ?? null,
  };
}

export const FEATURES = {
  trips: "Saving and customising trips",
  documents: "Visa results tied to your saved documents",
  cascade: "The cascade explorer",
  expiry: "Expiry warnings",
} as const;
export type FeatureKey = keyof typeof FEATURES;

export function isFeatureKey(v: string | null | undefined): v is FeatureKey {
  return Boolean(v && Object.prototype.hasOwnProperty.call(FEATURES, v));
}
