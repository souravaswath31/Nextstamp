// One-off targeted update: the three itinerary activities edited in
// data/itineraries-seed.json (a closed cafe and two unconfirmed venues). Updates
// ItineraryDay.activities in place — the full seed would delete and recreate every itinerary.
import { PrismaClient } from "@prisma/client";
import itineraries from "../data/itineraries-seed.json";

const TARGETS: [string, number][] = [
  ["Cartagena + Medellín, Colombia", 1],
  ["Phoenix, Scottsdale & Tucson: Sonoran Desert Cities", 1],
  ["Cajun Country: Lafayette, the Atchafalaya Basin & the Prairie", 2],
];

async function main() {
  const prisma = new PrismaClient();
  for (const [title, dayNumber] of TARGETS) {
    const it = (itineraries as any[]).find((i) => i.title === title);
    const day = it?.days.find((d: any) => d.day_number === dayNumber);
    if (!day) throw new Error(`not in seed: ${title} day ${dayNumber}`);
    const row = await prisma.itinerary.findFirst({ where: { title }, select: { id: true } });
    if (!row) throw new Error(`not in database: ${title}`);
    const r = await prisma.itineraryDay.updateMany({
      where: { itineraryId: row.id, dayNumber },
      data: { activities: day.activities.join("|") },
    });
    console.log(`${title} day ${dayNumber}: ${r.count} row(s)`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
