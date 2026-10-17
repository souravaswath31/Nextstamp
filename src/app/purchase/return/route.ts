import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { paymentsConfigured, sessionToGrant } from "@/lib/entitlement";
import { grantEntitlement } from "@/lib/entitlementDb";
import { getStripe } from "@/lib/stripeServer";
import { SITE_URL } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

/**
 * Where Stripe sends the buyer back. The webhook is the source of truth, but it can
 * land a few seconds after this redirect, so this asks Stripe directly about the session
 * and grants right away if it is paid and belongs to the signed-in user. Granting is
 * idempotent, so the webhook arriving afterwards changes nothing.
 */
export async function GET(req: Request) {
  const to = (p: string) => NextResponse.redirect(new URL(p, SITE_URL));
  if (!paymentsConfigured()) return to("/pricing");

  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId || !/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) return to("/pricing");

  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return to("/login");

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const grant = sessionToGrant(session);
    if (grant && grant.userId === user.id) {
      await grantEntitlement(grant);
      return to("/profile?purchase=done");
    }
  } catch {
    // Fall through: the webhook may still grant it.
  }
  return to("/pricing?purchase=pending");
}
