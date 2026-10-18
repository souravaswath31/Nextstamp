// Adds the itineraries and visa rules that are in data/*.json but not yet in the
// database. INSERT ONLY: it never deletes or updates anything.
//
// `npm run seed` deletes and recreates all global content, which leaves production
// with empty tables if the connection drops mid-run and severs every user trip's
// link to its itinerary (UserTrip.itineraryId is SET NULL). When you have only
// added content, use this, plus `npm run seed:countries <names>` for new country
// guides.
//
//   npx tsx prisma/seed-additive.ts            # insert what's missing
//   npx tsx prisma/seed-additive.ts --dry-run  # say what it would insert
//
// Itineraries are matched by title and visa rules by (passport, destination,
// held-document country). Slugs are assigned over the WHOLE seed list in order, the
// same way seed.ts does, so a new itinerary gets the slug a full reseed would give
// it and existing slugs do not move as long as new titles are appended.
import { PrismaClient } from "@prisma/client";
import itinerariesSeed from "../data/itineraries-seed.json";
import visaRulesSeed from "../data/visa-rules-seed.json";
import { assignUniqueSlugs } from "../src/lib/slug";

const prisma = new PrismaClient();
const dry = process.argv.includes("--dry-run");

async function main() {
  const its = itinerariesSeed as any[];
  const slugs = assignUniqueSlugs(its.map((i) => i.title));

  const haveTitles = new Set((await prisma.itinerary.findMany({ select: { title: true } })).map((i) => i.title));
  const haveSlugs = new Set((await prisma.itinerary.findMany({ select: { slug: true } })).map((i) => i.slug));
  let addedIt = 0;
  for (const [i, it] of its.entries()) {
    if (haveTitles.has(it.title)) continue;
    if (haveSlugs.has(slugs[i])) {
      console.warn(`  skip "${it.title}": slug ${slugs[i]} is already taken by a different itinerary`);
      continue;
    }
    console.log(`  + itinerary: ${it.title}  (/itineraries/${slugs[i]})`);
    addedIt++;
    if (dry) continue;
    await prisma.itinerary.create({
      data: {
        title: it.title,
        slug: slugs[i],
        category: it.category.join(","),
        region: it.region,
        countries: it.countries.join(","),
        durationDaysMin: it.duration_days_min,
        durationDaysMax: it.duration_days_max,
        bestTimeDescription: it.best_time_description,
        bestTimeMonths: it.best_time_months.join(","),
        description: it.description,
        costTier: it.cost_tier,
        relatedStateSlugs: it.related_states ? it.related_states.join(",") : null,
        coverImageUrl: it.cover_image_url ?? null,
        isPublic: true,
        days: {
          create: it.days.map((d: any) => ({
            dayNumber: d.day_number,
            title: d.title,
            activities: (d.activities || []).join("|"),
            driveTime: d.drive_time ?? null,
            lodgingSuggestion: d.lodging_suggestion ?? null,
            coffeeWifiSpot: d.coffee_wifi_spot ?? null,
            latitude: d.latitude ?? null,
            longitude: d.longitude ?? null,
            eatTown: d.eat_town ?? null,
          })),
        },
        notes: {
          create: (it.food_culture || []).map((n: any) => ({
            category: "food_culture",
            placeType: n.place_type ?? null,
            name: n.name,
            description: n.description,
          })),
        },
      },
    });
  }

  const key = (p: string, d: string, h: string | null) => `${p}|${d}|${h ?? ""}`;
  const haveRules = new Set(
    (await prisma.visaRule.findMany({ select: { passportCountry: true, destinationCountry: true, requiresHeldDocumentCountry: true } }))
      .map((r) => key(r.passportCountry, r.destinationCountry, r.requiresHeldDocumentCountry))
  );
  let addedRules = 0;
  for (const r of visaRulesSeed as any[]) {
    if (haveRules.has(key(r.passport_country, r.destination_country, r.requires_held_document_country))) continue;
    addedRules++;
    if (dry) continue;
    await prisma.visaRule.create({
      data: {
        passportCountry: r.passport_country,
        destinationCountry: r.destination_country,
        visaType: r.visa_type,
        requiresHeldDocumentCountry: r.requires_held_document_country,
        conditionsText: r.conditions_text,
        maxStayDays: r.max_stay_days,
        feeNotes: r.fee_notes,
        sourceUrl: r.source_url,
        lastVerifiedDate: new Date(r.last_verified_date),
      },
    });
  }

  console.log(`${dry ? "Would add" : "Added"} ${addedIt} itineraries and ${addedRules} visa rules.`);
  console.log(
    `Database now has ${await prisma.itinerary.count()} itineraries and ${await prisma.visaRule.count()} visa rules.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
