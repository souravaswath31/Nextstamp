-- Launch hardening: indexes for the columns every request filters on, and a revoke for a
-- helper function the Supabase advisor flagged as callable by anonymous visitors.
-- Additive and idempotent. Apply with: npx tsx prisma/apply-sql.ts prisma/sql/2026-10-launch-indexes.sql
CREATE INDEX IF NOT EXISTS "HeldDocument_userId_idx" ON "HeldDocument" ("userId");
CREATE INDEX IF NOT EXISTS "UserTrip_userId_idx" ON "UserTrip" ("userId");
CREATE INDEX IF NOT EXISTS "TripCollaborator_userId_idx" ON "TripCollaborator" ("userId");
CREATE INDEX IF NOT EXISTS "TripExpense_tripId_idx" ON "TripExpense" ("tripId");
CREATE INDEX IF NOT EXISTS "ItineraryDay_itineraryId_idx" ON "ItineraryDay" ("itineraryId");
CREATE INDEX IF NOT EXISTS "RoadEat_stopId_idx" ON "RoadEat" ("stopId");
CREATE INDEX IF NOT EXISTS "EscapeGame_createdAt_idx" ON "EscapeGame" ("createdAt");
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated
