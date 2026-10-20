import type { Metadata } from "next";
import { Check } from "lucide-react";
import WaitlistForm from "@/components/site/WaitlistForm";
import { CtaLink, PageHeader, SECTION } from "@/components/site/MarketingBits";
import { getOptionalUser } from "@/lib/currentUser";
import { FEATURES, PRICE_AMOUNT_LABEL, PRICE_LABEL, REFUND_DAYS, TRIAL_DAYS, describeSubscription, isFeatureKey, paymentsConfigured } from "@/lib/entitlement";

export const metadata: Metadata = {
  title: "Pricing — NextStamp",
  description: "Browsing and the passport check are free. The personal parts are free for 30 days, then $39 a year. Cancel any time; 14-day refund.",
};

const FREE = [
  "Run the passport and visa check, no account",
  "Browse every state guide and country guide",
  "Browse and read every itinerary",
];

const PAID = [
  "Visa results tied to the passport and documents you save",
  "The cascade explorer: see what a visa you hold opens up",
  "Save trips and customise them day by day",
  "Warnings before a passport or visa you hold expires",
];

// Reads the session to show the right button, and the query string for where you came from.
export const dynamic = "force-dynamic";

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const live = paymentsConfigured();
  const user = live ? await getOptionalUser() : null;
  const unlock = str(searchParams.unlock);
  const purchase = str(searchParams.purchase);

  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Free to look. Free for 30 days to make it yours."
        lead={`Then ${PRICE_LABEL}. Cancel any time, and get a refund within ${REFUND_DAYS} days of any charge. Everything listed below exists today.`}
      />

      <section className={`${SECTION} pb-6`}>
{!live ? (
          <p className="rounded-card border border-stamp/40 bg-stamp/10 px-5 py-4 font-body text-sm text-bone">
            Payment isn&apos;t switched on yet. Until it is, everything on this page is free to use. The
            buy button below puts you on a list; it doesn&apos;t charge you.
          </p>
        ) : (
          <>
            {isFeatureKey(unlock) && !user?.fullAccess && (
              <p role="status" className="mb-3 rounded-card border border-coral/40 bg-coral/10 px-5 py-4 font-body text-sm text-bone">
                {FEATURES[unlock]} is part of full access: free for {TRIAL_DAYS} days, then {PRICE_LABEL}.
              </p>
            )}
            {purchase === "cancelled" && (
              <p role="status" className="mb-3 rounded-card border border-white/15 bg-white/[0.05] px-5 py-4 font-body text-sm text-bone">
                No card was added and nothing was charged. You can start your trial any time.
              </p>
            )}
            {purchase === "error" && (
              <p role="alert" className="mb-3 rounded-card border border-stampRed/40 bg-stampRed/10 px-5 py-4 font-body text-sm text-bone">
                We couldn&apos;t start the checkout, and nothing was charged. Try again in a minute.
              </p>
            )}
            {purchase === "pending" && !user?.fullAccess && (
              <p role="status" className="mb-3 rounded-card border border-stamp/40 bg-stamp/10 px-5 py-4 font-body text-sm text-bone">
                We haven&apos;t had confirmation of your trial yet. It can take a minute. Refresh this page, and if
                it still isn&apos;t showing, contact us with the email Stripe sent you.
              </p>
            )}
          </>
        )}

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-panel border border-white/10 bg-nightRaised p-7">
            <p className="font-stamp text-[11px] uppercase tracking-widest text-white/55">Free</p>
            <p className="mt-2 font-display text-4xl text-white">$0</p>
            <ul className="mt-6 space-y-3">
              {FREE.map((f) => (
                <li key={f} className="flex gap-3 font-body text-sm text-white/75">
                  <Check size={16} className="mt-0.5 shrink-0 text-forest" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-panel border border-coral/40 bg-nightRaised p-7">
            <p className="font-stamp text-[11px] uppercase tracking-widest text-coral">Full access</p>
            <p className="mt-2 font-display text-4xl text-white">
              {PRICE_AMOUNT_LABEL} <span className="font-body text-base font-normal text-white/55">a year, after {TRIAL_DAYS} days free</span>
            </p>
            <ul className="mt-6 space-y-3">
              {PAID.map((f) => (
                <li key={f} className="flex gap-3 font-body text-sm text-white/75">
                  <Check size={16} className="mt-0.5 shrink-0 text-coral" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            <p className="mt-6 font-body text-xs text-white/55">
              Everything in Free is included.
            </p>
            {!live ? (
              <div className="mt-4">
                <p className="mb-2 font-body text-sm font-medium text-white/80">Tell me when the free trial opens</p>
                <WaitlistForm interest="paid" label="Join the list" inputId="pricing-email" />
              </div>
            ) : user?.fullAccess ? (
              <div role="status" className="mt-4 space-y-3 rounded-card bg-forest/15 px-4 py-3 font-body text-sm text-bone">
                <p>
                  {user.entitlement && user.entitlement.source === "stripe"
                    ? describeSubscription(user.entitlement, (d) => d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }))
                    : "You have full access. Thank you."}
                </p>
                {user.entitlement?.stripeCustomerId && (
                  <form action="/api/billing-portal" method="post">
                    <button type="submit" className="btn-pill btn-pill-accent">Manage billing or cancel</button>
                  </form>
                )}
              </div>
            ) : user ? (
              <form action="/api/checkout" method="post" className="mt-4">
                <button type="submit" className="btn-pill btn-pill-accent">
                  Start your {TRIAL_DAYS}-day free trial
                </button>
                <p className="mt-2 font-body text-xs text-white/55">
                  You add a card on Stripe&apos;s page; nothing is charged today. NextStamp never sees your card details.
                </p>
              </form>
            ) : (
              <div className="mt-4">
                <CtaLink href="/login">Sign in to start your free trial</CtaLink>
                <p className="mt-2 font-body text-xs text-white/55">Your plan is tied to your account.</p>
              </div>
            )}
          </div>
        </div>

        <section className="mt-10 max-w-2xl" aria-labelledby="trial-terms">
          <h2 id="trial-terms" className="font-display text-xl text-white">How the free trial works</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 font-body text-sm leading-relaxed text-white/75">
            <li>You get {TRIAL_DAYS} days of full access free. To start, you add a card; nothing is charged today.</li>
            <li>On day {TRIAL_DAYS + 1}, {PRICE_LABEL} is charged to that card, and again every year until you cancel.</li>
            <li>Cancel any time from Manage billing (one click on Stripe&apos;s page). Cancel before the trial ends and you are never charged. Cancel later and you keep access until the end of the year you paid for.</li>
            <li>Within {REFUND_DAYS} days of any charge, ask for a refund and you get it, no questions asked. A refund ends the plan and stops further charges.</li>
            <li>One free trial per person.</li>
          </ul>
        </section>

        <p className="mt-8 max-w-2xl pb-14 font-body text-xs leading-relaxed text-white/55">
          NextStamp doesn&apos;t book or sell travel, and the price is for the software, not for any
          trip. Visa information is not legal advice; confirm with the official source before you book.
          {live && " Receipts come from Stripe. To ask for a refund or report a problem with a payment, write to us (see the contact page)."}
        </p>
      </section>
    </>
  );
}
