import type { Metadata } from "next";
import Link from "next/link";
import { GITHUB_URL, SUPPORT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Contact — NextStamp",
  description: "How to reach NextStamp about a wrong visa rule, your data, a payment or anything else.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/55">Contact</p>
        <h1 className="mt-2 font-display text-4xl tracking-tightest text-ink">Get in touch</h1>
        <p className="mt-3 font-body text-base text-ink/75">
          NextStamp is a small, independently run project. A person reads what you send.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-display text-xl text-ink">A visa rule looks wrong</h2>
        <p className="font-body text-sm text-ink/75">
          Use the &ldquo;Report an error&rdquo; link under any result. It goes to the person who checks rules against the
          official page. A report on its own never changes a rule, but it moves that rule to the front of the queue.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl text-ink">Your data, your account or a payment</h2>
        <p className="font-body text-sm text-ink/75">
          You can download or delete your data yourself from your <Link href="/profile" className="text-coral underline">Profile</Link>.
          For anything else, including refunds:{" "}
          {SUPPORT_EMAIL ? (
            <a className="text-coral underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          ) : (
            <>open an issue on <a className="text-coral underline" href={GITHUB_URL}>our GitHub page</a> (do not post personal details there)</>
          )}
          .
        </p>
      </section>

      <p className="font-body text-xs text-ink/55">
        See the <Link href="/privacy" className="text-coral underline">Privacy Policy</Link> and{" "}
        <Link href="/terms" className="text-coral underline">Terms</Link>.
      </p>
    </div>
  );
}
