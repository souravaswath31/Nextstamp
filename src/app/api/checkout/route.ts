import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { PRICE_CURRENCY, PRICE_MINOR, PRODUCT_NAME, PRODUCT_TAG, paymentsConfigured } from "@/lib/entitlement";
import { userHasFullAccess } from "@/lib/entitlementDb";
import { getStripe } from "@/lib/stripeServer";
import { SITE_URL } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

const back = (path: string) => NextResponse.redirect(new URL(path, SITE_URL), 303);

export async function POST(req: Request) {
  if (!paymentsConfigured()) return back("/pricing");

  // Same-origin only: a form on another site must not be able to start a checkout for a signed-in user.
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(SITE_URL).origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Bad origin." }, { status: 403 });
  }

  const supabase = createClient(await cookies());
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return back("/login");
  const user = await prisma.user.findUnique({ where: { id: authUser.id }, select: { id: true, email: true } });
  if (!user) return back("/onboarding");

  if (await userHasFullAccess(user.id)) return back("/profile");

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    client_reference_id: user.id,
    customer_email: user.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: PRICE_CURRENCY,
          unit_amount: PRICE_MINOR,
          product_data: {
            name: PRODUCT_NAME,
            description: "One payment, no subscription. Unlocks saved trips, the cascade explorer, document-based visa results and expiry warnings.",
          },
        },
      },
    ],
    metadata: { product: PRODUCT_TAG },
    payment_intent_data: { metadata: { product: PRODUCT_TAG, userId: user.id } },
    success_url: `${SITE_URL}/purchase/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/pricing?purchase=cancelled`,
  });

  return NextResponse.redirect(session.url ?? new URL("/pricing", SITE_URL), 303);
}
