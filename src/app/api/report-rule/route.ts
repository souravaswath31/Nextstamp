import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { hasAuthCookie } from "@/lib/authCookie";
import { prisma } from "@/lib/prisma";
import { cleanText } from "@/lib/validate";
import { SITE_URL } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

const PER_HOUR_ALL = 60; // a ceiling on the whole site, counted from rows so it holds across servers
const PER_DAY_USER = 10;

const reply = (status: number, error?: string) => NextResponse.json(error ? { ok: false, error } : { ok: true }, { status });

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(SITE_URL).origin && origin !== new URL(req.url).origin) return reply(403, "Bad origin.");

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return reply(400, "That didn't arrive intact. Try again.");
  }
  // Honeypot: a bot fills every field. Pretend success so it learns nothing.
  if (typeof body.website === "string" && body.website.trim()) return reply(200);

  const passport = cleanText(body.passport, 56);
  const destination = cleanText(body.destination, 56);
  const heldDocument = cleanText(body.heldDocument, 56) || null;
  const message = cleanText(body.message, 600);
  const contact = cleanText(body.contact, 120) || null;
  if (!passport || !destination) return reply(400, "Something is missing from that report.");
  if (message.length < 10) return reply(400, "Tell us what looks wrong, in a sentence or two.");

  // Only count real rules: a report about a pair that does not exist is noise.
  const exists = await prisma.visaRule.findFirst({ where: { passportCountry: passport, destinationCountry: destination }, select: { id: true } });
  if (!exists) return reply(400, "We don't have a rule for that pair.");

  let userId: string | null = null;
  const jar = await cookies();
  if (hasAuthCookie(jar.getAll().map((c) => c.name))) {
    const { data: { user } } = await createClient(jar).auth.getUser();
    userId = user?.id ?? null;
  }

  const hourAgo = new Date(Date.now() - 3600_000);
  if ((await prisma.ruleReport.count({ where: { createdAt: { gt: hourAgo } } })) >= PER_HOUR_ALL) {
    return reply(429, "We're getting a lot of reports right now. Try again a little later.");
  }
  if (userId && (await prisma.ruleReport.count({ where: { userId, createdAt: { gt: new Date(Date.now() - 86_400_000) } } })) >= PER_DAY_USER) {
    return reply(429, "You've sent several reports today. We'll go through them first.");
  }

  await prisma.ruleReport.create({ data: { passport, destination, heldDocument, message, contact, userId } });
  return reply(200);
}
