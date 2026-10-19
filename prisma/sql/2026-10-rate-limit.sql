-- Shared rate-limit counters. The old limiters lived in each serverless instance's memory, so a
-- burst spread across instances was never counted. One row per (hashed) key; additive and idempotent.
CREATE TABLE IF NOT EXISTS "RateLimit" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "count" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "RateLimit_windowStart_idx" ON "RateLimit" ("windowStart");
ALTER TABLE "RateLimit" ENABLE ROW LEVEL SECURITY
