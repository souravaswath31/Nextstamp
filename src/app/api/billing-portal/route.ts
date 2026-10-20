import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { paymentsConfigured } from "@/lib/entitlement";
import { getStripe } from "@/lib/stripeServer";
import { SITE_URL } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

const back = (path: string) => NextResponse.redirect(new URL(path, SITE_URL), 303);

// Sends a signed-in subscriber to Stripe's customer portal: update the card, see invoices, cancel. Cancelling is
// one click there, on purpose. The portal needs one-time setup in the Stripe dashboard (Settings, Billing, Customer portal).
export async function POST(req: Request) {
  if (!paymentsConfigured()) return back("/pricing");

  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(SITE_URL).origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Bad origin." }, { status: 403 });
  }

  const { data: { user } } = await createClient(await cookies()).auth.getUser();
  if (!user) return back("/login");

  const row = await prisma.entitlement.findUnique({ where: { userId: user.id }, select: { stripeCustomerId: true } });
  if (!row?.stripeCustomerId) return back("/pricing");

  try {
    const portal = await getStripe().billingPortal.sessions.create({ customer: row.stripeCustomerId, return_url: `${SITE_URL}/profile` });
    return NextResponse.redirect(portal.url, 303);
  } catch (err) {
    console.error("[billing-portal] could not open the portal", err instanceof Error ? err.message : err);
    return back("/profile?billing=error");
  }
}
