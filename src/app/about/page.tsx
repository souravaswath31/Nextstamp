import type { Metadata } from "next";
import Link from "next/link";
import { getSiteStats } from "@/lib/siteData";
import { Block, PageHeader } from "@/components/site/MarketingBits";

// Public and the same for everyone, so it is served from cache and refreshed hourly.
export const revalidate = 3600;


export const metadata: Metadata = {
  title: "About NextStamp",
  description: "What NextStamp is, how it's built, and the rule it won't break: nothing goes in that we can't source.",
};

export default async function AboutPage() {
  const stats = await getSiteStats();
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="A trip planner that starts with whether you can go."
        lead="Most planners help you pick a place and find out later that your passport needs a visa you can't get in time. NextStamp starts at the other end."
      />

      <Block title="What it is">
        <p>
          NextStamp checks a destination against the passport you carry and the documents you hold,
          then helps you plan the trip: {stats.itineraries} itineraries, {stats.states} US state guides and{" "}
          {stats.countryGuides} country guides, packing lists, budgets, a shared planner for
          travelling companions, and a notebook for what you&apos;ve set aside.
        </p>
        <p>
          The part we care most about is the cascade: a valid visa from one country can ease entry to
          others, and most checkers never ask whether you have one.
        </p>
      </Block>

      <Block title="The rule we don't break">
        <p>
          Nothing goes in that we can&apos;t source. Every visa rule links to an official page and
          shows the date it was checked. If we can&apos;t confirm something, such as a drive time or a
          rule for a passport we haven&apos;t researched, we leave it out or say we don&apos;t know. We
          don&apos;t fill the gap with something plausible.
        </p>
        <p>
          That has cost us content. It has also caught real mistakes: an audit found dozens of rules
          resting on an aggregated reference page, and re-checking them against official sources turned
          up wrong stay lengths and a wrongly classified visa type, all fixed.
        </p>
      </Block>

      <Block title="What it isn't">
        <p>
          NextStamp isn&apos;t a law firm, an immigration adviser or a travel agency. It doesn&apos;t
          book flights, hotels or tours. Visa information is a research aid, not advice; the
          destination&apos;s own authority decides.
        </p>
      </Block>

      <Block title="Read the fine print">
        <p>
          <Link href="/terms" className="text-coral hover:underline">Terms</Link> and{" "}
          <Link href="/privacy" className="text-coral hover:underline">privacy</Link> are drafts that
          haven&apos;t been reviewed by a lawyer.
        </p>
      </Block>
    </>
  );
}
