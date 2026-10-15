import type { Metadata } from "next";
import { Check } from "lucide-react";
import WaitlistForm from "@/components/site/WaitlistForm";
import { PageHeader, SECTION } from "@/components/site/MarketingBits";

export const metadata: Metadata = {
  title: "Pricing — NextStamp",
  description: "Browsing and the passport check are free. A one-time $5 payment covers the personal parts. Payment isn't switched on yet.",
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

export default function PricingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Free to look. $5, once, to make it yours."
        lead="One payment, no subscription. Everything listed below exists today."
      />

      <section className={`${SECTION} pb-6`}>
        <p className="rounded-card border border-stamp/40 bg-stamp/10 px-5 py-4 font-body text-sm text-bone">
          Payment isn&apos;t switched on yet. Until it is, everything on this page is free to use. The
          buy button below puts you on a list; it doesn&apos;t charge you.
        </p>

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
            <div className="mt-4">
              <p className="mb-2 font-body text-sm font-medium text-white/80">Tell me when I can buy it</p>
              <WaitlistForm interest="paid" label="Join the list" inputId="pricing-email" />
            </div>
          </div>
        </div>

        <p className="mt-8 max-w-2xl pb-14 font-body text-xs leading-relaxed text-white/45">
          NextStamp doesn&apos;t book or sell travel, and the price is for the software, not for any
          trip. Visa information is not legal advice; confirm with the official source before you book.
        </p>
      </section>
    </>
  );
}
