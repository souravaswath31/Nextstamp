// Applies one additive SQL file over DIRECT_URL (the pooled URL can't run DDL
// reliably). Usage: npx tsx prisma/apply-sql.ts prisma/sql/2026-10-phase-b.sql
// Idempotent as long as the file uses IF NOT EXISTS, which they all do.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: tsx prisma/apply-sql.ts <file.sql>");
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  const sql = readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  for (const stmt of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
    await prisma.$executeRawUnsafe(stmt);
    console.log("ok:", stmt.split("\n")[0].slice(0, 90));
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
