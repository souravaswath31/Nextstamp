import type { Metadata } from "next";
import Link from "next/link";
import { GITHUB_URL, SUPPORT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Privacy Policy — NextStamp",
  description: "What NextStamp collects, why, who processes it, how long it is kept and how to delete it.",
  alternates: { canonical: "/privacy" },
};

// A fixed date: change it only when the text changes, so "last updated" tells the truth.
const LAST_UPDATED = "19 October 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/55">Legal</p>
        <h1 className="mt-2 font-display text-4xl tracking-tightest text-ink">Privacy Policy</h1>
        <p className="mt-3 inline-block rounded-full bg-stampRed/10 px-3 py-1 font-stamp text-xs font-semibold uppercase tracking-widest text-stampRed">
          Draft — awaiting legal review
        </p>
        <p className="mt-3 font-body text-sm text-ink/65">Last updated {LAST_UPDATED}.</p>
      </div>

      <div className="rounded-panel bg-stamp/10 p-5 font-body text-sm text-ink/75 shadow-paper">
        This is a plain-language description of what the app does today. It has not yet been reviewed by a lawyer, and
        we will update it, and its date, when it has been.
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">What we collect</h2>
        <ul className="list-inside list-disc space-y-2 font-body text-sm text-ink/75">
          <li><strong className="text-ink">Your email address and name</strong> — to sign you in (by email link or through Google) and to show you to people you plan trips with. We do not have or store a password.</li>
          <li><strong className="text-ink">Your passport country and passport expiry date</strong> — to work out visa status and warn you before a passport expires. The expiry date is optional.</li>
          <li><strong className="text-ink">Documents you add</strong> (visa or residence permit, the country that issued it, its type and expiry) — to work out which extra destinations open up. This is the core of the product; we use it for nothing else.</li>
          <li><strong className="text-ink">Trips you save or plan</strong> — itineraries you start or edit, travel dates, destination, packing lists, saved places and expenses. Co-travelers you invite see the trip and each other&rsquo;s names; only the owner sees co-travelers&rsquo; email addresses.</li>
          <li><strong className="text-ink">Trip fund entries</strong> — targets and amounts you type in. NextStamp never holds money or connects to a bank.</li>
          <li><strong className="text-ink">Trips drafted from a post</strong> — if you use &ldquo;Trip from a link&rdquo;, we keep the link and the public text we read from it so you can see where each stop came from. Screenshots are read once and not stored. You can delete the saved text from the trip page.</li>
          <li><strong className="text-ink">Escape Hatch games</strong> — the first name you type, your answers and votes, and the game&rsquo;s settings. A game is deleted automatically after 7 days. If you choose to share a result, only the trip chosen and the group size are kept, with no names.</li>
          <li><strong className="text-ink">Waitlist signups</strong> — your email and what you asked to hear about. We do not send marketing email from it.</li>
          <li><strong className="text-ink">Plan and payment record</strong> — if you start the free trial or subscribe, we keep your plan status, trial and renewal dates, the amount and your Stripe customer reference. Card details go straight to Stripe and never reach us.</li>
          <li><strong className="text-ink">Page-view counts</strong> — Vercel Web Analytics counts visits to pages. It sets no cookie and we do not attach it to your account, your documents or your trips.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Who processes it</h2>
        <p className="font-body text-sm text-ink/75">These providers handle data for us, under their own terms:</p>
        <ul className="list-inside list-disc space-y-2 font-body text-sm text-ink/75">
          <li><strong className="text-ink">Supabase</strong> — our database and sign-in (including the emails that carry your sign-in link).</li>
          <li><strong className="text-ink">Vercel</strong> — hosts the app and provides page-view counts.</li>
          <li><strong className="text-ink">Google</strong> — only if you choose &ldquo;Continue with Google&rdquo;.</li>
          <li><strong className="text-ink">Stripe</strong> — takes payment when payments are switched on.</li>
          <li><strong className="text-ink">Anthropic, MapTiler and OpenRouteService</strong> — only if you start a &ldquo;Trip from a link&rdquo; import: the text or screenshots you give it, and the place names and coordinates found in them.</li>
          <li><strong className="text-ink">Weather, exchange-rate, public-holiday and government travel-advice services</strong> — our server asks them about a destination and dates. These requests do not include your name, email, passport or documents.</li>
        </ul>
        <p className="font-body text-sm text-ink/75">
          We do not sell your data and we do not share it with anyone else. Visa rules, itineraries and guides are our own
          sourced content, not personal data. These providers may handle data outside your country.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">How long we keep it</h2>
        <ul className="list-inside list-disc space-y-2 font-body text-sm text-ink/75">
          <li>Account, documents, trips and expenses: until you delete them or your account.</li>
          <li>Escape Hatch games: 7 days.</li>
          <li>Unfinished trip imports: 24 hours.</li>
          <li>Payment records at Stripe: as long as the law requires them to be kept.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Your control over it</h2>
        <p className="font-body text-sm text-ink/75">
          From your <Link href="/profile" className="text-coral underline">Profile</Link> you can download everything we hold
          about you as a file, remove a document, and delete your account. Deleting your account removes your documents,
          the trips you own (people you shared them with lose access), expenses you paid on trips, your trip fund and your
          plan record here, and cancels any subscription so you are not billed again. It cannot be undone. You can also correct your passport details at any time. If you are in
          the EU, UK or California you have the rights to access, correct, delete and port your data; the tools above cover
          them, and you can write to us for anything they do not.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Cookies and storage</h2>
        <p className="font-body text-sm text-ink/75">
          One cookie, set by Supabase, keeps you signed in. Escape Hatch stores a small random token in your browser so you
          can rejoin the same game. Neither is used for tracking or advertising.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Age</h2>
        <p className="font-body text-sm text-ink/75">NextStamp is not for anyone under 16. Do not create an account if you are.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Contact</h2>
        <p className="font-body text-sm text-ink/75">
          {SUPPORT_EMAIL ? (
            <>Questions about your data: <a className="text-coral underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</>
          ) : (
            <>Questions about your data: open an issue on <a className="text-coral underline" href={GITHUB_URL}>our GitHub page</a>. Do not post personal details there.</>
          )}
        </p>
      </section>

      <p className="font-body text-xs text-ink/55">
        See also our <Link href="/terms" className="text-coral underline">Terms of Service</Link>.
      </p>
    </div>
  );
}
