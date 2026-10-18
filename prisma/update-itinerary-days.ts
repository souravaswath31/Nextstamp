// Brings the database's itinerary day text in line with data/itineraries-seed.json after
// `scripts/patch_itinerary.py apply`. UPDATES day title/activities/drive time/lodging and the
// itinerary's description and best-time text, matched by (itinerary title, day number). It
// never inserts or deletes, and never touches coordinates, eat towns or user trips.
//
//   npx tsx prisma/update-itinerary-days.ts --dry-run
//   npx tsx prisma/update-itinerary-days.ts
import { PrismaClient } from "@prisma/client";
import itinerariesSeed from "../data/itineraries-seed.json";

const prisma = new PrismaClient();
const dry = process.argv.includes("--dry-run");

async function main() {
  const rows = await prisma.itinerary.findMany({ include: { days: true } });
  const byTitle = new Map(rows.map((r) => [r.title, r]));
  let itUpdated = 0, daysUpdated = 0, missing = 0;
  for (const it of itinerariesSeed as any[]) {
    const row = byTitle.get(it.title);
    if (!row) { missing++; continue; }
    const top = {
      description: it.description,
      bestTimeDescription: it.best_time_description,
      bestTimeMonths: it.best_time_months.join(","),
      durationDaysMin: it.duration_days_min,
      durationDaysMax: it.duration_days_max,
      costTier: it.cost_tier,
    };
    const topDiffers = Object.entries(top).some(([k, v]) => (row as any)[k] !== v);
    if (topDiffers) {
      itUpdated++;
      if (!dry) await prisma.itinerary.update({ where: { id: row.id }, data: top });
    }
    for (const d of it.days) {
      const cur = row.days.find((x) => x.dayNumber === d.day_number);
      if (!cur) continue;
      const data = {
        title: d.title,
        activities: (d.activities || []).join("|"),
        driveTime: d.drive_time ?? null,
        lodgingSuggestion: d.lodging_suggestion ?? null,
        coffeeWifiSpot: d.coffee_wifi_spot ?? null,
      };
      const differs =
        cur.title !== data.title || cur.activities !== data.activities ||
        (cur.driveTime ?? null) !== data.driveTime || (cur.lodgingSuggestion ?? null) !== data.lodgingSuggestion ||
        (cur.coffeeWifiSpot ?? null) !== data.coffeeWifiSpot;
      if (differs) {
        daysUpdated++;
        if (!dry) await prisma.itineraryDay.update({ where: { id: cur.id }, data });
      }
    }
  }
  console.log(`${dry ? "Would update" : "Updated"} ${itUpdated} itineraries and ${daysUpdated} days (${missing} seed itineraries not in the database).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
