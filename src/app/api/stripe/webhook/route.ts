import { NextResponse } from "next/server";
import { paymentsConfigured } from "@/lib/entitlement";
import { restoreByCustomer, revokeByCustomer, saveSubscription } from "@/lib/entitlementDb";
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
    const stripe = getStripe();
    const outcome = await handleStripeEvent(event, {
      save: saveSubscription,
      revoke: revokeByCustomer,
      restore: restoreByCustomer,
      customerOfPaymentIntent: async (pi) => {
        const intent = await stripe.paymentIntents.retrieve(pi);
        return typeof intent.customer === "string" ? intent.customer : intent.customer?.id ?? null;
      },
      // A refund ends the plan: cancel any live subscription so the person is not billed again.
      cancelForCustomer: async (customerId) => {
        const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
        for (const s of subs.data) {
          if (s.status !== "canceled" && s.metadata?.product === "nextstamp-full-access") await stripe.subscriptions.cancel(s.id);
        }
      },
    });
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    // Logged with the event id so a failed delivery in the Stripe dashboard can be matched to a log line.
    console.error("[stripe webhook] handler failed", event.id, event.type, err instanceof Error ? err.message : err);
    // A 500 makes Stripe retry, which is what we want for a transient database error.
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }
}
