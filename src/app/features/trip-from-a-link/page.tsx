import type { Metadata } from "next";
import Link from "next/link";
import WaitlistForm from "@/components/site/WaitlistForm";
import TripImporter from "@/components/site/TripImporter";
import { Block, CtaLink, PageHeader, SECTION } from "@/components/site/MarketingBits";
import { getOptionalUser } from "@/lib/currentUser";
import { importEnabled } from "@/lib/tripImport/extract";

export const metadata: Metadata = {
  title: "Trip from a link — NextStamp",
  description:
    "Paste a travel video or post and get a draft trip built from the places it actually names, each one labelled as from the post or suggested by us.",
};

// Reads the session cookie to decide between the tool and the sign-in prompt.
export const dynamic = "force-dynamic";

export default async function TripFromALinkPage() {
  const enabled = importEnabled();
  const user = enabled ? await getOptionalUser() : null;

  return (
    <>
      <PageHeader
        eyebrow={enabled ? "Trip from a link" : "Coming soon"}
        title="Turn a travel post into a trip you can plan."
        lead="Paste the link to a public Instagram, TikTok or YouTube post, or paste its caption, or upload screenshots. NextStamp pulls out the places the post mentions and drafts a trip from them."
      />

      {enabled && user && (
        <section className="border-t border-white/10 bg-nightRaised/40">
          <div className={`${SECTION} py-12`}>
            <div className="max-w-2xl">
              <TripImporter />
            </div>
          </div>
        </section>
      )}

      {enabled && !user && (
        <section className="border-t border-white/10 bg-nightRaised/40">
          <div className={`${SECTION} py-12`}>
            <h2 className="font-display text-2xl tracking-tightest text-white">Sign in to try it</h2>
            <p className="mt-2 max-w-xl font-body text-sm text-white/60">
              Importing uses an AI model, so it needs an account. Browsing and the passport checker stay free.
            </p>
            <div className="mt-5">
              <CtaLink href="/login">Sign in</CtaLink>
            </div>
          </div>
        </section>
      )}

      {!enabled && (
        <section className="border-t border-white/10 bg-nightRaised/40">
          <div className={`${SECTION} py-12`}>
            <h2 className="font-display text-2xl tracking-tightest text-white">Tell me when it&apos;s ready</h2>
            <p className="mt-2 max-w-xl font-body text-sm text-white/60">
              It isn&apos;t switched on yet. Leave your email and you&apos;ll be on the list. We haven&apos;t
              set up email sending, so nothing will arrive until we do.
            </p>
            <div className="mt-5 max-w-xl">
              <WaitlistForm interest="trip-link" inputId="tfl-email" />
            </div>
          </div>
        </section>
      )}

      <Block title={enabled ? "How it works" : "How it will work"}>
        <ul className="list-disc space-y-2 pl-5">
          <li>Only the places and activities the post actually contains. Every stop is labelled as coming from the post, or as a suggestion from NextStamp, so you can tell which is which.</li>
          <li>Places are matched to our own guides first, then looked up. If we can&apos;t place something confidently, it stays off the map.</li>
          <li>The stops are put in order, and drive times shown, only from real routing data. Without it, you&apos;ll see the stops unordered and a note saying so.</li>
          <li>We don&apos;t keep the video. You can delete an imported trip and its source data at any time.</li>
        </ul>
      </Block>

      <Block title="What it won't do">
        <p>
          It won&apos;t read private accounts or get around a platform&apos;s limits. If a link
          can&apos;t be read, paste the caption or upload screenshots instead; both are meant to work
          as well as the link does.
        </p>
        <p>
          Opening hours, closures and traffic aren&apos;t checked. Treat the draft as a starting point, and
          check the places before you go. See the <Link href="/privacy" className="underline">privacy page</Link> for what we keep.
        </p>
      </Block>
    </>
  );
}
