// Pushes ONLY the geocoded coordinates from data/state-guides-seed.json into
// the existing StatePlace rows.
//
//   npm run seed:coords
//
// `npm run seed` would also do this, but it deletes and recreates every state
// guide to get there — and a mid-run connection drop then leaves production
// with no state guides at all until a rerun completes (this has happened twice;
// see CLAUDE.md, "Incident: npm run seed is not actually crash-safe"). Writing
// two columns on rows that already exist is a far smaller thing to do, and
// it's what you want after re-running scripts/geocode_places.py.
//
// Matched on (state slug, place name) because StatePlace ids are cuids
// regenerated on every full reseed and so aren't stable across runs.
import { PrismaClient } from "@prisma/client";
import stateGuidesSeed from "../data/state-guides-seed.json";

const prisma = new PrismaClient();

async function main() {
  const states = stateGuidesSeed as any[];
  let updated = 0;
  let cleared = 0;
  let missing = 0;

  for (const state of states) {
    const guide = await prisma.stateGuide.findUnique({
      where: { slug: state.slug },
      include: { places: { select: { id: true, name: true } } },
    });
    if (!guide) {
      console.warn(`  ! no state guide in the database for ${state.slug} — skipping`);
      continue;
    }

    const byName = new Map(guide.places.map((p) => [p.name, p.id]));

    for (const place of state.places) {
      const id = byName.get(place.name);
      if (!id) {
        missing += 1;
        continue;
      }
      const lat = place.latitude ?? null;
      const lon = place.longitude ?? null;
      await prisma.statePlace.update({
        where: { id },
        data: { latitude: lat, longitude: lon },
      });
      if (lat === null) cleared += 1;
      else updated += 1;
    }
  }

  const withCoords = await prisma.statePlace.count({ where: { latitude: { not: null } } });
  const total = await prisma.statePlace.count();
  console.log(
    `\n${updated} places given coordinates, ${cleared} left without ` +
      `(unresolved, or food/culture entries that have no location)` +
      (missing > 0 ? `, ${missing} in the seed file had no matching row` : "") +
      `.\nDatabase now has ${withCoords} of ${total} places mapped.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
