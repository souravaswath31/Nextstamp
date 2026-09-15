import { PrismaClient } from "@prisma/client";
import itinerariesSeed from "../data/itineraries-seed.json";
import visaRulesSeed from "../data/visa-rules-seed.json";
import stateGuidesSeed from "../data/state-guides-seed.json";

let prisma = new PrismaClient();

// Supabase's pooled connection (port 6543, PgBouncer) has been observed to
// drop a long-lived connection mid-script (P1017 "server has closed the
// connection") once a seed run's total query count/duration gets large
// enough — this hit production mid-run twice in a row (once during
// itineraries, once during visa rules), each time leaving later tables
// empty until a full rerun succeeded. Retrying a single create with a fresh
// client handles a drop without having to restart the whole seed from zero.
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 3): Promise<T> {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const isConnectionDrop = e?.code === "P1017" || /server has closed the connection/i.test(String(e?.message));
      if (!isConnectionDrop || i === attempts) throw e;
      console.warn(`  [retry ${i}/${attempts - 1}] connection dropped while ${label}, reconnecting...`);
      await prisma.$disconnect();
      prisma = new PrismaClient();
    }
  }
  throw new Error("unreachable");
}

async function main() {
  // This only touches global/shared content — Itinerary, VisaRule, StateGuide
  // and their children. It never touches User, HeldDocument, or UserTrip:
  // those belong to real signed-up accounts now, and a content reseed must
  // be safe to run against production without wiping anyone's data.
  // (UserTrip.itineraryId is an optional FK with onDelete: SetNull, so a
  // trip that pointed at a re-seeded itinerary just loses that link — its
  // own customDaysJson, which is its actual day-by-day plan, is untouched.)
  console.log("Clearing existing global content...");
  await prisma.itinerary.deleteMany();
  await prisma.visaRule.deleteMany();
  await prisma.stateGuide.deleteMany();

  console.log(`Seeding ${itinerariesSeed.length} itineraries...`);
  for (const it of itinerariesSeed as any[]) {
    await withRetry(() => prisma.itinerary.create({
      data: {
        title: it.title,
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
        isPublic: true,
        days: {
          create: it.days.map((d: any) => ({
            dayNumber: d.day_number,
            title: d.title,
            activities: (d.activities || []).join("|"),
            driveTime: d.drive_time ?? null,
            lodgingSuggestion: d.lodging_suggestion ?? null,
            coffeeWifiSpot: d.coffee_wifi_spot ?? null,
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
    }), `itinerary "${it.title}"`);
  }

  console.log(`Seeding ${visaRulesSeed.length} visa rules...`);
  for (const r of visaRulesSeed as any[]) {
    await withRetry(() => prisma.visaRule.create({
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
    }), `visa rule "${r.passport_country} -> ${r.destination_country}"`);
  }

  console.log(`Seeding ${stateGuidesSeed.length} state guides...`);
  for (const s of stateGuidesSeed as any[]) {
    await withRetry(() => prisma.stateGuide.create({
      data: {
        name: s.name,
        slug: s.slug,
        region: s.region,
        heroTagline: s.hero_tagline,
        heroDescription: s.hero_description,
        bestTimeToVisit: s.best_time_to_visit,
        altitudeOrClimateNote: s.altitude_or_climate_note ?? null,
        permitsNote: s.permits_note ?? null,
        gearNote: s.gear_note ?? null,
        terrain: s.terrain ?? "mountain",
        places: {
          create: s.places.map((p: any, i: number) => ({
            category: p.category,
            placeType: p.place_type ?? null,
            name: p.name,
            description: p.description,
            tip: p.tip ?? null,
            nearestTown: p.nearest_town ?? null,
            sortOrder: i,
          })),
        },
      },
    }), `state guide "${s.name}"`);
  }

  console.log("Done seeding global content.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
