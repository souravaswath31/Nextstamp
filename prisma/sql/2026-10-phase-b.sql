-- Phase B (trip from a link): the import record. Additive only.
CREATE TABLE IF NOT EXISTS "TripImport" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tripId" TEXT REFERENCES "UserTrip"("id") ON DELETE CASCADE,
  "sourceKind" TEXT NOT NULL,
  "platform" TEXT,
  "sourceUrl" TEXT,
  "sourceText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TripImport_userId_createdAt_idx" ON "TripImport"("userId","createdAt");
ALTER TABLE "TripImport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripSavedPlace" ADD COLUMN IF NOT EXISTS "quote" TEXT;
