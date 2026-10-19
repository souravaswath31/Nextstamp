"use server";

import { headers } from "next/headers";
import { prisma } from "./prisma";
import { validateWaitlist } from "./waitlist";
import { withinLimit } from "./rateLimitDb";
import { mailConfigured, sendMail } from "./mail";

export type WaitlistState = { status: "idle" | "ok" | "error"; message: string };

export async function joinWaitlist(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  // 5 attempts per address per 10 minutes, counted in the database so it holds across servers.
  if (!(await withinLimit("waitlist", ip, 5, 600))) {
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
  const alreadyThere = await prisma.waitlistSignup.findUnique({ where: { email_interest: { email: v.email, interest: v.interest } }, select: { id: true } });
  await prisma.waitlistSignup.upsert({
    where: { email_interest: { email: v.email, interest: v.interest } },
    create: { email: v.email, interest: v.interest, requestedPassport: v.requestedPassport },
    update: v.requestedPassport ? { requestedPassport: v.requestedPassport } : {},
  });
  if (!mailConfigured()) {
    return { status: "ok", message: "You're on the list. We haven't built email sending yet, so nothing will arrive until we do." };
  }
  let sent = false;
  if (!alreadyThere) {
    sent = await sendMail(
      v.email,
      "You're on the NextStamp list",
      `Thanks for joining the NextStamp list (${v.interest}).\n\nWe'll write when it is ready. We won't email you about anything else, and you can reply to this message to be removed.\n\nNextStamp`
    );
  }
  return { status: "ok", message: sent ? "You're on the list. We've emailed you a confirmation." : "You're on the list." };
}
