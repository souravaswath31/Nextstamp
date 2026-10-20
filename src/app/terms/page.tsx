import type { Metadata } from "next";
import Link from "next/link";
import { PRICE_LABEL, REFUND_DAYS, TRIAL_DAYS } from "@/lib/entitlement";

export const metadata: Metadata = {
  title: "Terms of Service — NextStamp",
  description: "The terms for using NextStamp.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/55">Legal</p>
        <h1 className="mt-2 font-display text-4xl tracking-tightest text-ink">Terms of Service</h1>
        <p className="mt-3 inline-block rounded-full bg-stampRed/10 px-3 py-1 font-stamp text-xs font-semibold uppercase tracking-widest text-stampRed">Draft — needs a lawyer</p>
        <p className="mt-3 font-body text-sm text-ink/55">Last updated {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}.</p>
      </div>

      <div className="rounded-panel bg-stamp/10 p-5 font-body text-sm text-ink/70 shadow-paper">
        A plain-language starting point, not yet reviewed by a lawyer. Accurate to how the
        app works today. Have it reviewed before relying on it for anything commercial.
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">The most important thing to know</h2>
        <p className="font-body text-sm text-ink/70">
          <strong className="text-ink">NextStamp is not a substitute for official immigration
          advice.</strong> Every visa rule in the app carries a source and a verification date,
          and we work to keep them accurate — but immigration policy changes, and a rule can
          be stale, wrong, or not applicable to your specific situation. Always confirm with
          the destination country's official immigration authority before booking travel or
          relying on any visa-free, visa-on-arrival, or visa-required status shown here.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">What NextStamp is</h2>
        <p className="font-body text-sm text-ink/70">
          A trip-planning tool: destination guides, itineraries, and a visa-status checker
          based on the passport and travel documents you tell us you hold. It's currently
          free to use. If that changes in the future, we'll update these terms and tell you
          before anything is charged.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Your account</h2>
        <p className="font-body text-sm text-ink/70">
          You sign in with an email link or with Google; there is no NextStamp password. Keep access to your email
          account secure, since that's what secures your NextStamp account. You're
          responsible for the accuracy of the passport and document information you enter.
        </p>
      </section>

      <section className="space-y-3" id="subscription">
        <h2 className="font-display text-xl text-ink">Free trial, subscription, cancelling and refunds</h2>
        <p className="font-body text-sm text-ink/70">
          Browsing, the passport check and the guides are free. The personal features (saved trips, document-based visa results,
          the cascade explorer, expiry warnings) are part of a plan with a {TRIAL_DAYS}-day free trial, then {PRICE_LABEL}.
          To start the trial you add a card on Stripe&apos;s page; nothing is charged during the trial. On day {TRIAL_DAYS + 1}
          the card is charged {PRICE_LABEL}, and the plan renews and charges again every year until you cancel. There is one free
          trial per person.
        </p>
        <p className="font-body text-sm text-ink/70">
          You can cancel at any time from Manage billing on the pricing page or your profile. If you cancel before the trial ends you are not
          charged. If you cancel after a charge you keep access until the end of the period you paid for, and the plan does not renew.
          Within {REFUND_DAYS} days of any charge, ask for a refund and you will get it, no questions asked; a refund ends the plan.
          Payments are processed by Stripe. Prices may include or add sales tax, VAT or GST where the law requires it, shown before you pay.
        </p>
        <p className="font-body text-sm text-ink/70">
          If a renewal payment fails we keep your access while Stripe retries the card for a few days; if it keeps failing the plan ends.
          We may change the price for future renewals, and will tell you before it applies to you.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Links to outside suppliers</h2>
        <p className="font-body text-sm text-ink/70">
          NextStamp links to outside flight, hotel and tour suppliers. We don&apos;t sell or book
          travel, take payment for it, hold your money or issue tickets; any booking is a contract
          between you and the supplier, under the supplier&apos;s terms. Some of those links are
          affiliate links, marked as such on the page, and we may earn a commission if you book
          through one. It doesn&apos;t add to what you pay.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Acceptable use</h2>
        <p className="font-body text-sm text-ink/70">
          Use the app for its intended purpose — planning your own trips. Don't attempt to
          scrape, resell, or redistribute the content library, and don't use the service in a
          way that disrupts it for other users.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">No warranty</h2>
        <p className="font-body text-sm text-ink/70">
          The app is provided as-is. Budget estimates, packing lists, and drive-time
          suggestions are planning aids based on general patterns, not guarantees for your
          specific trip. We make a real effort to source and date-verify visa and travel
          content, but we don't warrant that any piece of information is complete, current,
          or error-free.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Changes</h2>
        <p className="font-body text-sm text-ink/70">
          We may update these terms as the product changes. Continuing to use NextStamp after
          an update means you accept the revised terms.
        </p>
      </section>

      <p className="font-body text-xs text-ink/55">
        See also our <Link href="/privacy" className="text-coral underline">Privacy Policy</Link>.
      </p>
    </div>
  );
}
