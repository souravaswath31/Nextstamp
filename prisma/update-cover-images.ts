// Sets `coverImageUrl` from data/itineraries-seed.json (matched by title) where the database has
// none, or still has a generic /category-*.jpg and the seed now names a dedicated /itineraries/ image.
// It never overwrites any other cover and touches nothing else.
//
//   npx tsx prisma/update-cover-images.ts --dry-run
//   npx tsx prisma/update-cover-images.ts
import { PrismaClient } from "@prisma/client";
import itinerariesSeed from "../data/itineraries-seed.json";

const prisma = new PrismaClient();
const dry = process.argv.includes("--dry-run");

async function main() {
  const rows = await prisma.itinerary.findMany({ select: { id: true, title: true, coverImageUrl: true } });
  const byTitle = new Map(rows.map((r) => [r.title, r]));
  let updated = 0, missing = 0;
  for (const it of itinerariesSeed as any[]) {
    const row = byTitle.get(it.title);
    if (!row) { missing++; continue; }
    if (!it.cover_image_url || row.coverImageUrl === it.cover_image_url) continue;
    const upgrade = !!row.coverImageUrl && row.coverImageUrl.startsWith("/category-") && it.cover_image_url.startsWith("/itineraries/");
    if (row.coverImageUrl && !upgrade) continue;
    updated++;
    if (!dry) await prisma.itinerary.update({ where: { id: row.id }, data: { coverImageUrl: it.cover_image_url } });
  }
  console.log(`${dry ? "Would set" : "Set"} ${updated} cover images (${missing} seed itineraries not in the database).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
