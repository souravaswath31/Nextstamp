import type { Metadata } from "next";
import { getPublicRules, getSiteStats } from "@/lib/siteData";
import { getOptionalUser } from "@/lib/currentUser";
import { aOrAn } from "@/lib/article";
import { cascadeDocumentsFor, formatVerified } from "@/lib/passportCheck";
import CascadeDemo from "@/components/site/CascadeDemo";
import { Block, CtaLink, NOT_LEGAL_ADVICE, PageHeader, SECTION } from "@/components/site/MarketingBits";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "How the passport and visa check works — NextStamp",
  description:
    "NextStamp checks a destination against your passport and the visas you already hold. See how the check works, with the India passport and US visa as a worked example.",
};

export default async function VisaCheckFeaturePage() {
  const [rules, stats, user] = await Promise.all([getPublicRules(), getSiteStats(), getOptionalUser()]);
  // The interactive checker lives on the logged-out home page; a signed-in visitor's home page is
  // the dashboard, which has no #check anchor, so they go to the profile (their own full list).
  const checkHref = user ? "/profile" : "/#check";
  const passport = stats.passports.includes("India") ? "India" : stats.passports[0];
  const docs = cascadeDocumentsFor(rules, passport);
  const doc = docs[0] ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Passport and visa check"
        title="Your passport is only half of the answer."
        lead="Entry rules depend on the passport you carry and on what else you hold: a visa or residence from another country can ease entry somewhere new. NextStamp reads both."
      >
        <div className="mt-7">
          <CtaLink href={checkHref}>{user ? "See your destinations" : "Run the check"}</CtaLink>
        </div>
      </PageHeader>

      <Block title="What it tells you">
        <p>For a passport and a destination, the check returns:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>the visa type: visa free, visa on arrival, e-visa, or a visa you must get in advance;</li>
          <li>the longest stay the rule allows, when the source states one;</li>
          <li>the conditions and any fee the source mentions;</li>
          <li>a link to the official source, and the date we last checked it.</li>
        </ul>
        <p>
          Today that is {stats.visaRules} rules: {stats.passports.length} passports ({stats.passports.join(", ")})
          against {stats.destinations.length} destinations.
        </p>
      </Block>

      {doc && (
        <section className="border-t border-white/10 bg-nightRaised/40">
          <div className={`${SECTION} py-12 sm:py-14`}>
            <h2 className="max-w-2xl font-display text-2xl tracking-tightest text-white sm:text-3xl">
              Worked example: {aOrAn(passport)} {passport} passport and {aOrAn(doc === "USA" ? "US" : doc)} {doc === "USA" ? "US" : doc} visa
            </h2>
            <p className="mt-4 max-w-2xl font-body text-[15px] leading-relaxed text-white/65">
              On its own, the {passport} passport needs an advance visa for several destinations.
              Some of those countries ease entry for a traveller who holds a valid{" "}
              {doc === "USA" ? "US" : doc} visa. Use the switch to see exactly which ones move, and
              which don&apos;t.
            </p>
            <div className="mt-8">
              <CascadeDemo rules={rules} passport={passport} docCountry={doc} />
            </div>
            <p className="mt-4 max-w-2xl font-body text-sm text-white/55">
              Each easier entry has its own conditions, such as the type of visa and how long it must
              remain valid. Read the condition text on the result before you rely on it.
            </p>
          </div>
        </section>
      )}

      <Block title="How we source the rules" id="sources">
        <p>
          Each rule was researched from the destination&apos;s official immigration or foreign
          ministry pages, or from an embassy, and carries that link. Aggregated reference sites are
          not accepted as a source; an audit that found rules resting on one led to re-checking all
          of them.
        </p>
        <p>
          Each rule has a last-verified date.
          {stats.latestVerified && stats.oldestVerified && (
            <>
              {" "}Today the newest is {formatVerified(stats.latestVerified.toISOString().slice(0, 10))} and the
              oldest is {formatVerified(stats.oldestVerified.toISOString().slice(0, 10))}.
            </>
          )}{" "}
          A rule older than six months is flagged on the result rather than quietly shown as current.
        </p>
        <p>
          Where a pair of countries hasn&apos;t been researched, we say that. We never fill the gap
          with a guess, and &ldquo;not researched&rdquo; never means &ldquo;no visa needed.&rdquo;
        </p>
      </Block>

      <Block title="What it doesn't do">
        <p>
          It doesn&apos;t apply for a visa, and it doesn&apos;t know your individual circumstances: a
          criminal record, a previous overstay or a passport with little validity left can change the
          outcome. Border officers decide at the border.
        </p>
        <p className="text-white/55">{NOT_LEGAL_ADVICE}</p>
        <div className="pt-2">
          <CtaLink href={checkHref}>{user ? "See your destinations" : "Check a destination"}</CtaLink>
        </div>
      </Block>
    </>
  );
}
