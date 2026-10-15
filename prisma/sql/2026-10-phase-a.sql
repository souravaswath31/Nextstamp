-- Phase A (public site): itinerary slugs, waitlist, trip fund tracker.
-- Additive only. Itinerary.slug is added nullable, backfilled by
-- prisma/backfill-itinerary-slugs.ts, then made NOT NULL + unique.
ALTER TABLE "Itinerary" ADD COLUMN IF NOT EXISTS "slug" TEXT;

CREATE TABLE IF NOT EXISTS "WaitlistSignup" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "interest" TEXT NOT NULL,
  "requestedPassport" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "WaitlistSignup_email_interest_key" ON "WaitlistSignup"("email","interest");

CREATE TABLE IF NOT EXISTS "TripFund" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "targetMinor" INTEGER NOT NULL,
  "tripId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TripFund_userId_idx" ON "TripFund"("userId");

CREATE TABLE IF NOT EXISTS "TripFundEntry" (
  "id" TEXT PRIMARY KEY,
  "fundId" TEXT NOT NULL REFERENCES "TripFund"("id") ON DELETE CASCADE,
  "amountMinor" INTEGER NOT NULL,
  "note" TEXT,
  "enteredOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TripFundEntry_fundId_idx" ON "TripFundEntry"("fundId");
