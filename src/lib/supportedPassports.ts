import { prisma } from "./prisma";

/** Passports that have visa rules on file, straight from the data so the list can never drift from the product. */
export async function getSupportedPassports(): Promise<string[]> {
  const rows = await prisma.visaRule.findMany({ distinct: ["passportCountry"], select: { passportCountry: true } });
  return rows.map((r) => r.passportCountry).sort((a, b) => a.localeCompare(b));
}
