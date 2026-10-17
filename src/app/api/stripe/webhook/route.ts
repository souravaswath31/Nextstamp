import { NextResponse } from "next/server";
import { paymentsConfigured } from "@/lib/entitlement";
import { grantEntitlement, revokeByPaymentIntent } from "@/lib/entitlementDb";
import { getStripe } from "@/lib/stripeServer";
import { handleStripeEvent } from "@/lib/stripeWebhook";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!paymentsConfigured()) return NextResponse.json({ error: "Payments are not configured." }, { status: 404 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  // The signature covers the exact bytes, so read the raw body, never parsed JSON.
  const body = await req.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }

  try {
    const outcome = await handleStripeEvent(event, { grant: grantEntitlement, revoke: revokeByPaymentIntent });
    return NextResponse.json({ received: true, outcome });
  } catch {
    // A 500 makes Stripe retry, which is what we want for a transient database error.
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }
}
