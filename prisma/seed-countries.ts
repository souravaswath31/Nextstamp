// Seeds ONLY the country-guide tables, one country at a time, upserting.
//
// `npm run seed` deletes all global content up front and recreates it, which
// is fine for a full content refresh but is a bad trade when you've only added
// one researched country: a mid-run connection drop leaves production with
// empty itineraries and visa rules until a rerun completes (this happened
// twice — see CLAUDE.md, "Incident: npm run seed is not actually crash-safe").
//
// This script never deletes anything it isn't replacing. Each country is
// removed and recreated inside one transaction, so a failure part-way leaves
// the previous version of that country intact rather than a half-written one.
//
//   npm run seed:countries          # every country in the seed file
//   npm run seed:countries Japan    # just one
import { PrismaClient } from "@prisma/client";
import countryFactsSeed from "../data/country-facts-seed.json";

const prisma = new PrismaClient();

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toRow(c: any) {
  return {
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
    climateSourceUrl: c.climate_source_url ?? null,
    phrasesLanguage: c.phrases_language ?? null,

    sources: (c.sources ?? []).join("|"),
    lastVerifiedDate: new Date(c.last_verified_date),

    climate: {
      create: (c.climate ?? []).map((m: any) => ({
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
  };
}

async function main() {
  const only = process.argv.slice(2);
  const all = countryFactsSeed as any[];
  const wanted = only.length > 0 ? all.filter((c) => only.includes(c.country)) : all;

  if (wanted.length === 0) {
    console.log(
      only.length > 0
        ? `No country in data/country-facts-seed.json matches: ${only.join(", ")}`
        : "data/country-facts-seed.json is empty — nothing to seed."
    );
    return;
  }

  for (const c of wanted) {
    // Delete-then-create for this one country only, in a transaction. Children
    // go with it via onDelete: Cascade.
    await prisma.$transaction([
      prisma.countryFact.deleteMany({ where: { country: c.country } }),
      prisma.countryFact.create({ data: toRow(c) }),
    ]);
    console.log(
      `  seeded ${c.country} (${(c.climate ?? []).length} climate months, ${(c.phrases ?? []).length} phrases)`
    );
  }

  const total = await prisma.countryFact.count();
  console.log(`Done. ${total} country guide(s) in the database.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
