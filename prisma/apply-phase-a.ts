// One-off: applies prisma/sql/2026-10-phase-a.sql over DIRECT_URL, backfills
// Itinerary.slug, then makes it NOT NULL + unique. Idempotent.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { assignUniqueSlugs } from "../src/lib/slug";

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  const sql = readFileSync("prisma/sql/2026-10-phase-a.sql", "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  for (const stmt of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
    await prisma.$executeRawUnsafe(stmt);
  }
  const rows = await prisma.$queryRawUnsafe<{ id: string; title: string }[]>(
    'SELECT id, title FROM "Itinerary" ORDER BY "createdAt", id'
  );
  const slugs = assignUniqueSlugs(rows.map((r) => r.title));
  for (let i = 0; i < rows.length; i++) {
    await prisma.$executeRawUnsafe(
      'UPDATE "Itinerary" SET slug = $1 WHERE id = $2 AND slug IS NULL',
      slugs[i],
      rows[i].id
    );
  }
  await prisma.$executeRawUnsafe('ALTER TABLE "Itinerary" ALTER COLUMN "slug" SET NOT NULL');
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Itinerary_slug_key" ON "Itinerary"("slug")'
  );
  console.log(
    await prisma.$queryRawUnsafe('SELECT count(*)::int AS n, count(DISTINCT slug)::int AS distinct_slugs FROM "Itinerary"')
  );
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
