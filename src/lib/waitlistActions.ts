"use server";

import { headers } from "next/headers";
import { prisma } from "./prisma";
import { makeRateLimiter, validateWaitlist } from "./waitlist";

export type WaitlistState = { status: "idle" | "ok" | "error"; message: string };

// 5 attempts per address per 10 minutes. See makeRateLimiter for what that is
// and isn't worth on serverless.
const allow = makeRateLimiter(5, 10 * 60 * 1000);

export async function joinWaitlist(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (!allow(ip)) {
    return { status: "error", message: "Too many attempts from this connection. Try again in a few minutes." };
  }

  const v = validateWaitlist({
    email: String(formData.get("email") ?? ""),
    interest: String(formData.get("interest") ?? ""),
    requestedPassport: String(formData.get("requestedPassport") ?? ""),
    website: String(formData.get("website") ?? ""),
  });

  // A tripped honeypot gets the success message: telling a bot it failed only
  // teaches it which field to leave empty.
  if (!v.ok && v.silent) return { status: "ok", message: "You're on the list." };
  if (!v.ok) return { status: "error", message: v.error };

  // Same address, same interest: already on the list. Not an error to the
  // person, and not a second row.
  await prisma.waitlistSignup.upsert({
    where: { email_interest: { email: v.email, interest: v.interest } },
    create: { email: v.email, interest: v.interest, requestedPassport: v.requestedPassport },
    update: v.requestedPassport ? { requestedPassport: v.requestedPassport } : {},
  });
  return { status: "ok", message: "You're on the list. We haven't built email sending yet, so nothing will arrive until we do." };
}
