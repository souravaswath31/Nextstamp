// Who has paid, and what that unlocks (Phase D). The decisions here are pure so
// they can be tested without Stripe or a database; the database and Stripe
// calls live in entitlementDb.ts and the route handlers.
//
// The rule that matters most: **if payment isn't configured, everyone has full
// access.** Nothing is ever locked behind a purchase nobody can make. The gate
// only closes once Stripe keys are set, and the pricing page says which state
// it is in.

export const PRICE_MINOR = 3900;
export const PRICE_CURRENCY = "usd";
/** What the price is called on pages. One place, so the pricing page, the unlock cards and Stripe's own checkout text agree. */
export const PRICE_LABEL = "$39 a year";
export const PRICE_AMOUNT_LABEL = "$39";
/** A free trial for everyone, with a card collected up front so the first charge happens on day 31 unless they cancel. */
export const TRIAL_DAYS = 30;
/** Days after any charge in which a refund is given, no questions asked. */
export const REFUND_DAYS = 14;
export const PRODUCT_NAME = "NextStamp full access (annual)";
/** Stamped on every checkout session and subscription we create, so a webhook can ignore anyone else's sales on the same Stripe account. */
export const PRODUCT_TAG = "nextstamp-full-access";

type Env = Record<string, string | undefined>;

export function paymentsConfigured(env: Env = process.env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
}

export type EntitlementRow = { status: string; source: string } | null;

/** Subscription states that keep full access. past_due stays on while Stripe retries the card, so one declined payment does not
 *  lock someone out; Stripe cancels the subscription if the retries run out and that ends access. */
export const ACCESS_STATUSES = ["trialing", "active", "past_due"] as const;

/**
 * Full access if payments are off, the user has a trialing or paid subscription (or a manual grant), or they
 * are inside the optional grandfather window (PAID_GRANDFATHER_BEFORE: accounts created before that date keep
 * access). The plan is a 30-day trial for everyone, so the grandfather date is normally left unset.
 */
export function computeAccess(input: {
  configured: boolean;
  entitlement: EntitlementRow;
  userCreatedAt: Date;
  grandfatherBefore?: string | null;
}): boolean {
  if (!input.configured) return true;
  if (input.entitlement && (ACCESS_STATUSES as readonly string[]).includes(input.entitlement.status)) return true;
  const g = input.grandfatherBefore ? new Date(input.grandfatherBefore) : null;
  return Boolean(g && !Number.isNaN(g.getTime()) && input.userCreatedAt < g);
}

/** What we keep about a person's subscription. Stripe is the source of truth; this mirrors it. */
export type SubscriptionRecord = {
  userId: string;
  subscriptionId: string;
  customerId: string | null;
  status: string;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  amountMinor: number | null;
  currency: string | null;
};

type SubscriptionLike = {
  id: string;
  status?: string | null;
  customer?: string | { id: string } | null;
  metadata?: Record<string, string> | null;
  trial_end?: number | null;
  current_period_end?: number | null;
  cancel_at_period_end?: boolean | null;
  items?: { data?: { current_period_end?: number | null; price?: { unit_amount?: number | null; currency?: string | null } }[] } | null;
};

const USER_ID = /^[A-Za-z0-9_-]{8,64}$/;
const date = (unix: number | null | undefined) => (typeof unix === "number" && Number.isFinite(unix) ? new Date(unix * 1000) : null);

/** A subscription of ours that names a user, or null. Never mirrors a foreign or malformed subscription. */
export function subscriptionToRecord(sub: SubscriptionLike): SubscriptionRecord | null {
  if (sub.metadata?.product !== PRODUCT_TAG) return null;
  const userId = sub.metadata?.userId;
  if (!userId || !USER_ID.test(userId) || !sub.id || !sub.status) return null;
  const item = sub.items?.data?.[0];
  return {
    userId,
    subscriptionId: sub.id,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
    status: sub.status,
    trialEnd: date(sub.trial_end),
    // Newer Stripe API versions carry the period end on the item, older ones on the subscription.
    currentPeriodEnd: date(sub.current_period_end ?? item?.current_period_end),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    amountMinor: item?.price?.unit_amount ?? null,
    currency: item?.price?.currency ?? null,
  };
}

/** The line a person sees on their profile, from the mirrored record. */
export function describeSubscription(e: {
  status: string;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}, fmt: (d: Date) => string): string {
  const end = e.currentPeriodEnd ? fmt(e.currentPeriodEnd) : null;
  if (e.status === "trialing") {
    const t = e.trialEnd ?? e.currentPeriodEnd;
    return e.cancelAtPeriodEnd
      ? `Free trial, ending ${t ? fmt(t) : "soon"}. You have cancelled, so you will not be charged.`
      : `Free trial until ${t ? fmt(t) : "the end of the month"}. ${PRICE_LABEL} is charged then unless you cancel first.`;
  }
  if (e.status === "active") {
    return e.cancelAtPeriodEnd
      ? `Full access until ${end ?? "the end of the period"}. You have cancelled, so it will not renew.`
      : `Full access. Renews ${end ?? "yearly"} at ${PRICE_LABEL}.`;
  }
  if (e.status === "past_due") return "Your last payment did not go through. Update your card from Manage billing to keep access.";
  if (e.status === "refunded") return "This payment was refunded and full access is off.";
  return "No active plan.";
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
