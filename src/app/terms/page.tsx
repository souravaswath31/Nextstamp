import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — NextStamp",
  description: "The terms for using NextStamp.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/45">Legal</p>
        <h1 className="mt-2 font-display text-4xl tracking-tightest text-ink">Terms of Service</h1>
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
          You sign in with an email magic link — no password. Keep access to your email
          account secure, since that's what secures your NextStamp account. You're
          responsible for the accuracy of the passport and document information you enter.
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

      <p className="font-body text-xs text-ink/40">
        See also our <Link href="/privacy" className="text-coral underline">Privacy Policy</Link>.
      </p>
    </div>
  );
}
