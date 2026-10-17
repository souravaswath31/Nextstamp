import Stripe from "stripe";

let client: Stripe | null = null;

/** Server-only. Throws if the key is missing, so callers check paymentsConfigured() first. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(key);
  return client;
}
