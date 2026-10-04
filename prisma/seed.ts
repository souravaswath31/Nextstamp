import { PrismaClient } from "@prisma/client";
import itinerariesSeed from "../data/itineraries-seed.json";
import visaRulesSeed from "../data/visa-rules-seed.json";
import stateGuidesSeed from "../data/state-guides-seed.json";
import countryFactsSeed from "../data/country-facts-seed.json";
import roadEatsSeed from "../data/road-eats-seed.json";

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
  await prisma.countryFact.deleteMany();
  await prisma.roadEatStop.deleteMany(); // RoadEat rows go with it via cascade

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
            latitude: p.latitude ?? null,
            longitude: p.longitude ?? null,
          })),
        },
      },
    }), `state guide "${s.name}"`);
  }

  console.log(`Seeding ${countryFactsSeed.length} country guides...`);
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  for (const c of countryFactsSeed as any[]) {
    await withRetry(() => prisma.countryFact.create({
      data: {
        country: c.country,
        iso2: c.iso2,
        currencyCode: c.currency_code,
        currencyName: c.currency_name,
        primaryTimezone: c.primary_timezone,
        timezoneLabel: c.timezone_label,
        timezoneNote: c.timezone_note ?? null,

        passportValidityRule: c.passport_validity_rule,
        passportValidityMonthsBeyondEntry: c.passport_validity_months_beyond_entry ?? 0,
        passportValidityBasis: c.passport_validity_basis ?? "none",
        blankPagesRequired: c.blank_pages_required ?? null,
        onwardTicketRequired: c.onward_ticket_required ?? null,
        entryRequirementNotes: c.entry_requirement_notes ?? null,
        passportSourceUrl: c.passport_source_url ?? null,

        // Arrays collapse to comma-separated strings and the source-URL list
        // to a pipe-separated one, matching the convention the rest of this
        // schema already uses (Itinerary.countries, .category). src/lib/
        // countryFacts.ts owns the parsing on the way back out.
        healthRequiredVaccinations: (c.health?.required_vaccinations ?? []).join(","),
        healthRecommendedVaccinations: (c.health?.recommended_vaccinations ?? []).join(","),
        healthMalariaRisk: c.health?.malaria_risk ?? null,
        healthNotes: c.health?.notes ?? null,
        healthSourceUrl: c.health?.source_url ?? null,

        moneyCardAcceptance: c.money?.card_acceptance ?? null,
        moneyCashCulture: c.money?.cash_culture ?? null,
        moneyTipping: c.money?.tipping ?? null,
        moneyAtmNotes: c.money?.atm_notes ?? null,
        moneySourceUrl: c.money?.source_url ?? null,

        powerPlugTypes: (c.power?.plug_types ?? []).join(","),
        powerVoltage: c.power?.voltage ?? null,
        powerFrequency: c.power?.frequency ?? null,
        powerAdapterNote: c.power?.adapter_note ?? null,
        powerSourceUrl: c.power?.source_url ?? null,

        emergencyPolice: c.emergency?.police ?? null,
        emergencyAmbulance: c.emergency?.ambulance ?? null,
        emergencyFire: c.emergency?.fire ?? null,
        emergencyUniversal: c.emergency?.universal ?? null,
        emergencyTouristPolice: c.emergency?.tourist_police ?? null,
        emergencyNotes: c.emergency?.notes ?? null,
        emergencySourceUrl: c.emergency?.source_url ?? null,

        transitSummary: c.getting_around?.summary ?? null,
        transitPassesJson: JSON.stringify(c.getting_around?.passes ?? []),
        transitSourceUrl: c.getting_around?.source_url ?? null,

        esimSupported: c.connectivity?.esim_supported ?? null,
        localSimNotes: c.connectivity?.local_sim_notes ?? null,
        connectivityCost: c.connectivity?.typical_cost ?? null,
        simRegistrationRequired: c.connectivity?.registration_required ?? null,
        connectivitySourceUrl: c.connectivity?.source_url ?? null,

        climateReferenceCity: c.climate_reference_city ?? null,
        latitude: c.latitude ?? null,
        longitude: c.longitude ?? null,
        climateSourceUrl: c.climate_source_url ?? null,
        phrasesLanguage: c.phrases_language ?? null,

        sources: (c.sources ?? []).join("|"),
        lastVerifiedDate: new Date(c.last_verified_date),

        climate: {
          create: (c.climate ?? []).map((m: any) => ({
            // monthNumber is derived from position in the canonical month list
            // rather than trusted from the input, so ordering can't depend on
            // a research agent having spelled the month consistently.
            monthNumber: MONTHS.indexOf(m.month) + 1,
            month: m.month,
            avgHighC: m.avg_high_c ?? null,
            avgLowC: m.avg_low_c ?? null,
            precipitationNote: m.precipitation_note ?? null,
            crowdNote: m.crowd_note ?? null,
            rating: m.rating ?? "shoulder",
          })),
        },
        phrases: {
          create: (c.phrases ?? []).map((p: any, i: number) => ({
            phraseEn: p.phrase_en,
            local: p.local,
            romanization: p.romanization ?? null,
            sortOrder: i,
          })),
        },
      },
    }), `country guide "${c.country}"`);
  }

  console.log(`Seeding road eats for ${roadEatsSeed.length} region(s)...`);
  for (const r of roadEatsSeed as any[]) {
    for (const s of r.stops) {
      await withRetry(() => prisma.roadEatStop.create({
        data: {
          regionKey: r.region_key,
          town: s.town,
          note: s.note ?? null,
          noteSourceUrl: s.note_source_url ?? null,
          lastVerifiedDate: new Date(r.last_verified_date),
          eats: {
            create: s.eats.map((e: any, i: number) => ({
              name: e.name,
              kind: e.kind,
              meal: e.meal,
              whatToOrder: e.what_to_order,
              why: e.why,
              priceTier: e.price_tier ?? null,
              hoursNote: e.hours_note ?? null,
              openEvidence: e.open_evidence,
              sourceUrl: e.source_url,
              sourceName: e.source_name,
              sortOrder: i,
            })),
          },
        },
      }), `road eats "${r.region_key} / ${s.town}"`);
    }
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
