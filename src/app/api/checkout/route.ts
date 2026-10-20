import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { PRICE_CURRENCY, PRICE_LABEL, PRICE_MINOR, PRODUCT_NAME, PRODUCT_TAG, REFUND_DAYS, TRIAL_DAYS, paymentsConfigured } from "@/lib/entitlement";
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

  // Sales tax / VAT / GST: off until Stripe Tax is set up in the Stripe dashboard (registrations and an
  // origin address), because Stripe rejects the request if it is switched on without that. Set
  // STRIPE_AUTOMATIC_TAX=1 to turn it on. STRIPE_TAX_BEHAVIOR=exclusive adds tax on top of the price;
  // the default, inclusive, keeps the price at exactly what the pricing page says.
  const taxOn = process.env.STRIPE_AUTOMATIC_TAX === "1";
  const taxBehavior = process.env.STRIPE_TAX_BEHAVIOR === "exclusive" ? "exclusive" : "inclusive";

  // One free trial per person. Someone who has had a subscription before (and let it lapse or was refunded) is
  // charged from the start; someone returning keeps their Stripe customer so receipts stay in one place.
  const past = await prisma.entitlement.findUnique({ where: { userId: user.id }, select: { stripeCustomerId: true, stripeSubscriptionId: true } });
  const trialDays = past?.stripeSubscriptionId ? 0 : TRIAL_DAYS;

  let session;
  try {
    session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      // A card is collected up front even though nothing is charged during the trial, so day 31 can bill it.
      payment_method_collection: "always",
      ...(taxOn ? { automatic_tax: { enabled: true }, billing_address_collection: "required" as const } : {}),
      client_reference_id: user.id,
      ...(past?.stripeCustomerId ? { customer: past.stripeCustomerId } : { customer_email: user.email }),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: PRICE_CURRENCY,
            unit_amount: PRICE_MINOR,
            recurring: { interval: "year" },
            ...(taxOn ? { tax_behavior: taxBehavior as "inclusive" | "exclusive" } : {}),
            product_data: {
              name: PRODUCT_NAME,
              description: "Saved trips, the cascade explorer, document-based visa results and expiry warnings.",
            },
          },
        },
      ],
      metadata: { product: PRODUCT_TAG },
      subscription_data: {
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
        metadata: { product: PRODUCT_TAG, userId: user.id },
      },
      // The terms of the offer, in plain words, on the page where the card is entered.
      custom_text: {
        submit: {
          message:
            trialDays > 0
              ? `${TRIAL_DAYS}-day free trial, then ${PRICE_LABEL}, renewing every year. You will not be charged today. Cancel any time before the trial ends and you will never be charged. ${REFUND_DAYS}-day refund after any charge, no questions asked.`
              : `${PRICE_LABEL}, renewing every year. Cancel any time; you keep access until the end of the period you paid for. ${REFUND_DAYS}-day refund after any charge, no questions asked.`,
        },
      },
      success_url: `${SITE_URL}/purchase/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/pricing?purchase=cancelled`,
    });
  } catch (err) {
    console.error("[checkout] could not create a Stripe session", err instanceof Error ? err.message : err);
    return back("/pricing?purchase=error");
  }

  return NextResponse.redirect(session.url ?? new URL("/pricing", SITE_URL), 303);
}
