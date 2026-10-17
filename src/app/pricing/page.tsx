import type { Metadata } from "next";
import { Check } from "lucide-react";
import WaitlistForm from "@/components/site/WaitlistForm";
import { CtaLink, PageHeader, SECTION } from "@/components/site/MarketingBits";
import { getOptionalUser } from "@/lib/currentUser";
import { FEATURES, PRICE_LABEL, isFeatureKey, paymentsConfigured } from "@/lib/entitlement";

export const metadata: Metadata = {
  title: "Pricing — NextStamp",
  description: "Browsing and the passport check are free. A one-time $5 payment covers the personal parts.",
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
        title="Free to look. $5, once, to make it yours."
        lead="One payment, no subscription. Everything listed below exists today."
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
                {FEATURES[unlock]} is part of full access. It&apos;s {PRICE_LABEL}, once.
              </p>
            )}
            {purchase === "cancelled" && (
              <p role="status" className="mb-3 rounded-card border border-white/15 bg-white/[0.05] px-5 py-4 font-body text-sm text-bone">
                No payment was taken. You can buy any time.
              </p>
            )}
            {purchase === "pending" && !user?.fullAccess && (
              <p role="status" className="mb-3 rounded-card border border-stamp/40 bg-stamp/10 px-5 py-4 font-body text-sm text-bone">
                We haven&apos;t had confirmation of your payment yet. It can take a minute. Refresh this page, and if
                it still isn&apos;t showing, contact us with the receipt Stripe emailed you.
              </p>
            )}
          </>
        )}

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-panel border border-white/10 bg-nightRaised p-7">
            <p className="font-stamp text-[11px] uppercase tracking-widest text-white/45">Free</p>
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
            <p className="font-stamp text-[11px] uppercase tracking-widest text-coral">One-time</p>
            <p className="mt-2 font-display text-4xl text-white">
              $5 <span className="font-body text-base font-normal text-white/50">once</span>
            </p>
            <ul className="mt-6 space-y-3">
              {PAID.map((f) => (
                <li key={f} className="flex gap-3 font-body text-sm text-white/75">
                  <Check size={16} className="mt-0.5 shrink-0 text-coral" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            <p className="mt-6 font-body text-xs text-white/45">
              Everything in Free is included.
            </p>
            {!live ? (
              <div className="mt-4">
                <p className="mb-2 font-body text-sm font-medium text-white/80">Tell me when I can buy it</p>
                <WaitlistForm interest="paid" label="Join the list" inputId="pricing-email" />
              </div>
            ) : user?.fullAccess ? (
              <p role="status" className="mt-4 rounded-card bg-forest/15 px-4 py-3 font-body text-sm text-bone">
                You have full access. Thank you.
              </p>
            ) : user ? (
              <form action="/api/checkout" method="post" className="mt-4">
                <button type="submit" className="btn-pill btn-pill-accent">
                  Buy full access, {PRICE_LABEL} once
                </button>
                <p className="mt-2 font-body text-xs text-white/45">
                  You&apos;ll pay on Stripe&apos;s page. NextStamp never sees your card details.
                </p>
              </form>
            ) : (
              <div className="mt-4">
                <CtaLink href="/login">Sign in to buy</CtaLink>
                <p className="mt-2 font-body text-xs text-white/45">Your purchase is tied to your account.</p>
              </div>
            )}
          </div>
        </div>

        <p className="mt-8 max-w-2xl pb-14 font-body text-xs leading-relaxed text-white/45">
          NextStamp doesn&apos;t book or sell travel, and the price is for the software, not for any
          trip. Visa information is not legal advice; confirm with the official source before you book.
          {live && " Receipts come from Stripe. A refunded payment turns full access off. To ask for a refund or report a problem with a payment, contact us through the project's GitHub page."}
        </p>
      </section>
    </>
  );
}
