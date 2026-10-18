-- Escape Hatch: the multiplayer trip game. Additive and idempotent.
-- Apply with: npx tsx prisma/apply-sql.ts prisma/sql/2026-10-escape-hatch.sql
CREATE TABLE IF NOT EXISTS "EscapeGame" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "phase" TEXT NOT NULL DEFAULT 'lobby',
  "config" JSONB NOT NULL,
  "deck" JSONB,
  "result" JSONB,
  "seed" INTEGER NOT NULL,
  "redraws" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "EscapeGame_code_key" ON "EscapeGame"("code");
CREATE TABLE IF NOT EXISTS "EscapePlayer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "gameId" TEXT NOT NULL REFERENCES "EscapeGame"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "isHost" BOOLEAN NOT NULL DEFAULT false,
  "duels" JSONB,
  "budget" INTEGER,
  "pick" INTEGER,
  "veto" INTEGER,
  "voted" BOOLEAN NOT NULL DEFAULT false,
  "committed" BOOLEAN NOT NULL DEFAULT false,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "EscapePlayer_token_key" ON "EscapePlayer"("token");
CREATE INDEX IF NOT EXISTS "EscapePlayer_gameId_idx" ON "EscapePlayer"("gameId");
CREATE TABLE IF NOT EXISTS "EscapeOutcome" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fromState" TEXT NOT NULL,
  "days" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "budget" INTEGER NOT NULL,
  "reach" TEXT NOT NULL,
  "playerCount" INTEGER NOT NULL,
  "vibe" JSONB NOT NULL,
  "titles" JSONB NOT NULL,
  "winnerTitle" TEXT,
  "vetoedTitles" JSONB NOT NULL,
  "nothingFit" BOOLEAN NOT NULL DEFAULT false,
  "wish" TEXT
);
