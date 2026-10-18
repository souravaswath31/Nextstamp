// Brings the database's visa rules in line with data/visa-rules-seed.json after a
// re-verification: UPDATES rows whose content differs (matched by passport, destination and
// held-document country), INSERTS rules that are missing, and DELETES NOTHING.
//
//   npx tsx prisma/update-visa-rules.ts --dry-run   # report what would change
//   npx tsx prisma/update-visa-rules.ts
//
// This is what to run after `python3 scripts/reverify_visa.py apply ...`. The full
// `npm run seed` is destructive and is not needed for a content update.
import { PrismaClient } from "@prisma/client";
import visaRulesSeed from "../data/visa-rules-seed.json";

const prisma = new PrismaClient();
const dry = process.argv.includes("--dry-run");

async function main() {
  const rows = await prisma.visaRule.findMany();
  const byKey = new Map(
    rows.map((r) => [`${r.passportCountry}|${r.destinationCountry}|${r.requiresHeldDocumentCountry ?? ""}`, r])
  );
  let updated = 0, inserted = 0, same = 0;
  for (const r of visaRulesSeed as any[]) {
    const key = `${r.passport_country}|${r.destination_country}|${r.requires_held_document_country ?? ""}`;
    const data = {
      visaType: r.visa_type,
      conditionsText: r.conditions_text,
      maxStayDays: r.max_stay_days ?? null,
      feeNotes: r.fee_notes ?? null,
      sourceUrl: r.source_url,
      lastVerifiedDate: new Date(r.last_verified_date),
    };
    const cur = byKey.get(key);
    if (!cur) {
      inserted++;
      console.log(`  + ${key}`);
      if (!dry) {
        await prisma.visaRule.create({
          data: {
            passportCountry: r.passport_country,
            destinationCountry: r.destination_country,
            requiresHeldDocumentCountry: r.requires_held_document_country ?? null,
            ...data,
          },
        });
      }
      continue;
    }
    const differs =
      cur.visaType !== data.visaType ||
      cur.conditionsText !== data.conditionsText ||
      cur.maxStayDays !== data.maxStayDays ||
      (cur.feeNotes ?? null) !== data.feeNotes ||
      cur.sourceUrl !== data.sourceUrl ||
      cur.lastVerifiedDate.getTime() !== data.lastVerifiedDate.getTime();
    if (!differs) {
      same++;
      continue;
    }
    updated++;
    if (cur.visaType !== data.visaType) console.log(`  ~ ${key}: ${cur.visaType} -> ${data.visaType}`);
    if (!dry) await prisma.visaRule.update({ where: { id: cur.id }, data });
  }
  console.log(
    `${dry ? "Would update" : "Updated"} ${updated}, ${dry ? "would insert" : "inserted"} ${inserted}, ${same} already current.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
