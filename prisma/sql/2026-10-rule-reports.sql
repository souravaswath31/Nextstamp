-- User-submitted corrections to visa rules. A report never changes a rule by itself: it is a lead
-- for a person to check against the official page. Additive and idempotent.
CREATE TABLE IF NOT EXISTS "RuleReport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "passport" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "heldDocument" TEXT,
  "message" TEXT NOT NULL,
  "contact" TEXT,
  "userId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'new',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RuleReport_createdAt_idx" ON "RuleReport" ("createdAt");
CREATE INDEX IF NOT EXISTS "RuleReport_passport_destination_idx" ON "RuleReport" ("passport", "destination");
ALTER TABLE "RuleReport" ENABLE ROW LEVEL SECURITY
