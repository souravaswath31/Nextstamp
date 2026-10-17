import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { HeldDocument } from "@prisma/client";
import { prisma } from "./prisma";
import { computeAccess, paymentsConfigured } from "./entitlement";

/**
 * Attaches what the user has paid for. `heldDocuments` is what the visa engine
 * may use: the saved documents when the user has full access, an empty list when
 * they don't, so every visa and readiness computation downstream follows the
 * gate by default (a new call site can't forget to check). `savedHeldDocuments`
 * is always the real list, for showing "your documents are kept" on a locked page.
 * With payments unconfigured nothing is looked up or locked.
 */
async function withAccess<U extends { id: string; createdAt: Date; heldDocuments: HeldDocument[] }>(user: U) {
  const configured = paymentsConfigured();
  const entitlement = configured
    ? await prisma.entitlement.findUnique({ where: { userId: user.id } })
    : null;
  const fullAccess = computeAccess({
    configured,
    entitlement,
    userCreatedAt: user.createdAt,
    grandfatherBefore: process.env.PAID_GRANDFATHER_BEFORE,
  });
  return {
    ...user,
    fullAccess,
    entitlement,
    savedHeldDocuments: user.heldDocuments,
    heldDocuments: fullAccess ? user.heldDocuments : [],
  };
}

// Resolves the signed-in Supabase user to our own User row. Every call site
// that used to get the single hardcoded user now gets the real session's
// user, scoped to their own held documents and trips — the function's
// return shape hasn't changed, only where it comes from.
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: { heldDocuments: true },
  });

  if (!user) {
    // Signed in via Supabase, but hasn't finished the one-time profile step yet.
    redirect("/onboarding");
  }

  return withAccess(user);
}

// Same lookup as getCurrentUser(), but never redirects — returns null for a
// logged-out visitor or one who hasn't finished onboarding yet. For pages
// that are part of the free browsable content library (state guides,
// itineraries, the explore list) and should render for anyone, with
// personalization (visa status, the cascade filter) simply omitted when
// there's no user to personalize for.
export async function getOptionalUser() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: { heldDocuments: true },
  });
  return user ? withAccess(user) : null;
}
