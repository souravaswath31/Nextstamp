// Gives full access to a user by email without a purchase (testers, friends, anyone
// you've decided shouldn't pay). Usage: npx tsx prisma/grant-entitlement.ts someone@example.com
// Revoke with: npx tsx prisma/grant-entitlement.ts --revoke someone@example.com
import { PrismaClient } from "@prisma/client";

async function main() {
  const args = process.argv.slice(2);
  const revoke = args[0] === "--revoke";
  const email = (revoke ? args[1] : args[0])?.trim().toLowerCase();
  if (!email) throw new Error("usage: tsx prisma/grant-entitlement.ts [--revoke] <email>");
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user with email ${email}`);
  if (revoke) {
    const r = await prisma.entitlement.deleteMany({ where: { userId: user.id, source: "grant" } });
    console.log(`Removed ${r.count} manual grant(s) for ${email}`);
  } else {
    await prisma.entitlement.upsert({
      where: { userId: user.id },
      create: { userId: user.id, source: "grant", status: "active" },
      update: { status: "active" },
    });
    console.log(`Granted full access to ${email}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
