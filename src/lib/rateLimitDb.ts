// A rate limiter whose counts live in Postgres, so they hold across serverless instances (the
// in-memory one in waitlist.ts only counted per instance). One atomic upsert per check.
// Keys are hashed: the table never holds an address. On a database error it lets the request
// through, because blocking real people during an outage helps nobody.
import { createHash } from "crypto";
import { prisma } from "./prisma";

const SALT = process.env.RATE_LIMIT_SALT ?? "nextstamp";

export function rateKey(scope: string, who: string): string {
  return `${scope}:${createHash("sha256").update(`${SALT}|${who}`).digest("hex").slice(0, 32)}`;
}

/** Counts this call and returns true while the caller is within `limit` calls per `windowSeconds`. */
export async function withinLimit(scope: string, who: string, limit: number, windowSeconds: number): Promise<boolean> {
  const key = rateKey(scope, who);
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${key}, now(), 1)
      ON CONFLICT ("key") DO UPDATE SET
        "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds}::double precision) THEN now() ELSE "RateLimit"."windowStart" END,
        "count" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds}::double precision) THEN 1 ELSE "RateLimit"."count" + 1 END
      RETURNING "count"`;
    if (Math.random() < 0.01) {
      // Sweep stale rows now and then so the table stays small.
      void prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 86_400_000) } } }).catch(() => {});
    }
    return Number(rows[0]?.count ?? 1) <= limit;
  } catch (err) {
    console.error("[ratelimit] check failed, allowing", err instanceof Error ? err.message : err);
    return true;
  }
}
