import { prisma } from "./prisma";

export type PassportCoverage = { passport: string; destinations: number };

/** Passports with visa rules on file and how many destinations each covers, straight from the data so the
 *  list can never drift from the product. A passport with fewer destinations is partial, and is shown as such. */
export async function getPassportCoverage(): Promise<PassportCoverage[]> {
  const rows = await prisma.visaRule.findMany({ distinct: ["passportCountry", "destinationCountry"], select: { passportCountry: true, destinationCountry: true } });
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.passportCountry, (counts.get(r.passportCountry) ?? 0) + 1);
  return Array.from(counts, ([passport, destinations]) => ({ passport, destinations })).sort((a, b) => a.passport.localeCompare(b.passport));
}

export async function getSupportedPassports(): Promise<string[]> {
  return (await getPassportCoverage()).map((c) => c.passport);
}
