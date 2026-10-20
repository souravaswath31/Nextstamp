import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { PRODUCT_TAG, paymentsConfigured, subscriptionToRecord } from "@/lib/entitlement";
import { saveSubscription } from "@/lib/entitlementDb";
import { getStripe } from "@/lib/stripeServer";
import { SITE_URL } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

/**
 * Where Stripe sends the person after the trial signup. The webhook is the source of truth, but it can land a few
 * seconds after this redirect, so this asks Stripe directly about the session's subscription and mirrors it right away
 * if it is ours and belongs to the signed-in user. Mirroring is idempotent, so the webhook arriving afterwards changes nothing.
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
    const session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    const sub = session.subscription && typeof session.subscription !== "string" ? session.subscription : null;
    if (
      session.mode === "subscription" &&
      session.metadata?.product === PRODUCT_TAG &&
      session.client_reference_id === user.id &&
      sub
    ) {
      const rec = subscriptionToRecord(sub as unknown as Parameters<typeof subscriptionToRecord>[0]);
      if (rec && rec.userId === user.id) {
        await saveSubscription(rec);
        return to("/profile?purchase=done");
      }
    }
  } catch {
    // Fall through: the webhook may still mirror it.
  }
  return to("/pricing?purchase=pending");
}
