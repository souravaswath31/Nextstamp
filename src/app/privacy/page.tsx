import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — NextStamp",
  description: "What NextStamp collects, why, and who it's shared with.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/45">Legal</p>
        <h1 className="mt-2 font-display text-4xl tracking-tightest text-ink">Privacy Policy</h1>
        <p className="mt-3 font-body text-sm text-ink/55">Last updated {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}.</p>
      </div>

      <div className="rounded-panel bg-stamp/10 p-5 font-body text-sm text-ink/70 shadow-paper">
        This is a plain-language starting point, written by the people building NextStamp —
        not by a lawyer, and not yet reviewed by one. It accurately describes what the app
        does today. If you're relying on this for a commercial launch, payment processing,
        or operating in a jurisdiction with specific disclosure requirements (GDPR, CCPA,
        etc.), have it reviewed before you rely on it.
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">What we collect</h2>
        <ul className="list-inside list-disc space-y-2 font-body text-sm text-ink/70">
          <li><strong className="text-ink">Your email address</strong> — used only to send you a sign-in link. We don't have or store a password.</li>
          <li><strong className="text-ink">Your passport country and any held documents you add</strong> (visas, residency permits, their expiry dates) — used to compute visa status and expiry alerts. This is the core of the product; we don't use it for anything else.</li>
          <li><strong className="text-ink">Trips you save or plan</strong> — the itineraries you start, customize, or mark as booked/completed.</li>
          <li><strong className="text-ink">Nothing else.</strong> No analytics tracking, no advertising identifiers, no third-party trackers, as of this writing.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Who it's shared with</h2>
        <p className="font-body text-sm text-ink/70">
          Two infrastructure providers process data on our behalf, under their own privacy
          and security terms:
        </p>
        <ul className="list-inside list-disc space-y-2 font-body text-sm text-ink/70">
          <li><strong className="text-ink">Supabase</strong> — hosts our database and handles authentication (sending the magic-link emails, managing your session).</li>
          <li><strong className="text-ink">Vercel</strong> — hosts the application itself.</li>
        </ul>
        <p className="font-body text-sm text-ink/70">
          We don't sell data, and we don't share it with anyone else. Visa rules, itineraries,
          and state guides shown in the app are our own sourced content, not personal data.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Your control over it</h2>
        <p className="font-body text-sm text-ink/70">
          You can remove a held document at any time from your Profile page. You can delete a
          trip from your My Trips page. If you want your account and all associated data
          deleted entirely, contact us (see below) and we'll do it — there's no self-service
          account deletion yet.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Cookies</h2>
        <p className="font-body text-sm text-ink/70">
          We use one cookie, set by Supabase, to keep you signed in between visits. It's not
          used for tracking or advertising.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Questions</h2>
        <p className="font-body text-sm text-ink/70">
          This is a small, independently-run project. If you have a question about your data,
          the best way to reach us is through the contact information on our GitHub repository.
        </p>
      </section>

      <p className="font-body text-xs text-ink/40">
        See also our <Link href="/terms" className="text-coral underline">Terms of Service</Link>.
      </p>
    </div>
  );
}
