-- Subscriptions: the entitlement now mirrors a Stripe subscription (30-day trial, then yearly).
-- Additive and idempotent. The old one-time columns stay so nothing already stored is lost.
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "trialEnd" TIMESTAMP(3);
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "Entitlement_stripeSubscriptionId_key" ON "Entitlement" ("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "Entitlement_stripeCustomerId_idx" ON "Entitlement" ("stripeCustomerId")
