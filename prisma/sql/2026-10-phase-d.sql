-- Phase D (the $5 purchase): the entitlement record. Additive only.
CREATE TABLE IF NOT EXISTS "Entitlement" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'active',
  "source" TEXT NOT NULL,
  "stripeSessionId" TEXT UNIQUE,
  "stripePaymentIntentId" TEXT UNIQUE,
  "amountMinor" INTEGER,
  "currency" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "Entitlement" ENABLE ROW LEVEL SECURITY;
