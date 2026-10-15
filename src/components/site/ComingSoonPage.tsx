import type { ReactNode } from "react";
import WaitlistForm from "./WaitlistForm";
import { Block, PageHeader, SECTION } from "./MarketingBits";
import type { WaitlistInterest } from "@/lib/waitlist";

export default function ComingSoonPage({
  interest,
  eyebrow,
  title,
  lead,
  how,
}: {
  interest: WaitlistInterest;
  eyebrow: string;
  title: string;
  lead: string;
  how: ReactNode;
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} lead={lead} />
      <section className="border-t border-white/10 bg-nightRaised/40">
        <div className={`${SECTION} py-12`}>
          <h2 className="font-display text-2xl tracking-tightest text-white">Join the waitlist</h2>
          <p className="mt-2 max-w-xl font-body text-sm text-white/60">
            Not built yet. We haven&apos;t set up email sending, so nothing will arrive until we do.
          </p>
          <div className="mt-5 max-w-xl">
            <WaitlistForm interest={interest} inputId={`${interest}-email`} />
          </div>
        </div>
      </section>
      <Block title="How it will work">{how}</Block>
    </>
  );
}
