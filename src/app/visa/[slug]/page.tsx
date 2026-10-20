import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TrustNotes from "@/components/TrustNotes";
import { SITE_URL } from "@/lib/siteUrl";
import { slugify } from "@/lib/slug";
import { VISA_TYPE_LABEL, formatVerified } from "@/lib/passportCheck";
import { getCachedRules } from "@/lib/visaPagesData";
import {
  answerSentence, baseRule, cascadeDocuments, cascadeImprovements, cascadeSlug, docLabel, isIndexablePair, pairRules, pairSlug, parseVisaSlug,
} from "@/lib/visaPages";

// Served from cache and rebuilt hourly: nothing here depends on who is looking.
export const revalidate = 3600;
export async function generateStaticParams() {
  return [];
}

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const rules = await getCachedRules();
  const parsed = parseVisaSlug(params.slug, rules);
  if (!parsed) return { robots: { index: false } };
  if (parsed.kind === "pair") {
    const base = baseRule(rules, parsed.passport, parsed.destination);
    if (pairRules(rules, parsed.passport, parsed.destination).length === 0) {
      return { title: `${parsed.passport} passport to ${parsed.destination} — not researched yet — NextStamp`, robots: { index: false, follow: true } };
    }
    const title = `${parsed.destination} visa for ${parsed.passport} passport holders — NextStamp`;
    return {
      title,
      description: base ? `${answerSentence(base)} Checked ${formatVerified(base.verified)} against the official source.` : `Entry rules for ${parsed.passport} passport holders going to ${parsed.destination}.`,
      alternates: { canonical: `/visa/${params.slug}` },
      robots: isIndexablePair(rules, parsed.passport, parsed.destination) ? { index: true, follow: true } : { index: false, follow: true },
    };
  }
  const n = cascadeImprovements(rules, parsed.passport, parsed.doc).length;
  return {
    title: `${parsed.passport} passport + ${docLabel(parsed.doc)} visa: where it opens the door — NextStamp`,
    description: `${n} destinations where holding a ${docLabel(parsed.doc)} visa or permit changes entry for ${parsed.passport} passport holders, each with its official source and the date we checked it.`,
    alternates: { canonical: `/visa/${params.slug}` },
    robots: n >= 3 ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function VisaPage({ params }: Props) {
  const rules = await getCachedRules();
  const parsed = parseVisaSlug(params.slug, rules);
  if (!parsed) notFound();

  if (parsed.kind === "cascade") {
    const items = cascadeImprovements(rules, parsed.passport, parsed.doc);
    if (items.length === 0) notFound();
    const doc = docLabel(parsed.doc);
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <Crumbs items={[["Visa checker", "/visa"], [`${parsed.passport} passport`, `/visa/from/${slugify(parsed.passport)}`], [`With a ${doc} visa`, null]]} />
        <div>
          <p className="font-stamp text-xs uppercase tracking-widest text-ink/55">Held-visa shortcut</p>
          <h1 className="mt-2 font-display text-4xl tracking-tightest text-ink sm:text-5xl">
            {parsed.passport} passport + {doc} visa: where it opens the door
          </h1>
          <p className="mt-4 max-w-2xl font-body text-lg text-ink/75">
            On the {parsed.passport} passport alone, these {items.length} destinations ask for more. If you also hold a valid {doc} visa or
            permit, the destination&apos;s own rules treat you more easily. Each line below quotes the condition and links to the
            official page it came from.
          </p>
          <p className="mt-3 font-body text-sm text-ink/65">
            The conditions matter: validity, single or multiple entry, whether the visa must have been used once, and whether a
            visa or only a residence permit counts. Read them before you rely on a line.
          </p>
        </div>
        <ul className="space-y-4">
          {items.map(({ destination, base, withDoc }) => (
            <li key={destination} className="rounded-panel bg-paper p-5 shadow-paper">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-xl text-ink">
                  <Link href={`/visa/${pairSlug(parsed.passport, destination)}`} className="hover:underline">{destination}</Link>
                </h2>
                <p className="font-body text-sm text-ink/75">
                  {base ? <span className="text-ink/55">{VISA_TYPE_LABEL[base.visaType]} → </span> : null}
                  <strong className="text-ink">{VISA_TYPE_LABEL[withDoc.visaType]}</strong>
                  {withDoc.maxStayDays ? ` · ${withDoc.maxStayDays} days` : ""}
                </p>
              </div>
              <p className="mt-2 font-body text-sm leading-relaxed text-ink/75">{withDoc.conditions}</p>
              <div className="mt-3 border-t border-line pt-3">
                <TrustNotes conditions={withDoc.conditions} sourceUrl={withDoc.sourceUrl} verified={withDoc.verified} passport={parsed.passport} destination={destination} heldDocument={parsed.doc} />
              </div>
            </li>
          ))}
        </ul>
        <Disclaimer />
        <JsonLd data={breadcrumbLd([["Visa checker", "/visa"], [`${parsed.passport} passport`, `/visa/from/${slugify(parsed.passport)}`], [`With a ${doc} visa`, `/visa/${params.slug}`]])} />
      </div>
    );
  }

  const { passport, destination } = parsed;
  const base = baseRule(rules, passport, destination);
  const all = pairRules(rules, passport, destination);
  if (all.length === 0) {
    // A real passport and a real destination we simply have not researched together. Say so plainly rather than
    // showing a 404, and keep it out of search results.
    const researched = Array.from(new Set(rules.filter((r) => r.passport === passport).map((r) => r.destination))).sort();
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Crumbs items={[["Visa checker", "/visa"], [`${passport} passport`, `/visa/from/${slugify(passport)}`], [destination, null]]} />
        <h1 className="font-display text-4xl tracking-tightest text-ink sm:text-5xl">{passport} passport to {destination}</h1>
        <p className="max-w-2xl font-body text-lg text-ink/85">
          We haven&apos;t researched this pair yet. That is not the same as &ldquo;no visa needed&rdquo;. Check {destination}&apos;s embassy or immigration authority before you book.
        </p>
        <p className="font-body text-sm text-ink/75">
          We add pairs only when we can source them from an official page. Meanwhile there are {researched.length} destinations we have checked for the {passport} passport.
        </p>
        <Link href={`/visa/from/${slugify(passport)}`} className="btn-pill btn-pill-primary inline-flex">See the {researched.length} we have checked</Link>
        <Disclaimer />
      </div>
    );
  }
  const lead = base ?? all[0];
  const variants = all.filter((r) => r.requiresDocCountry);
  const others = Array.from(new Set(rules.filter((r) => r.passport === passport && r.destination !== destination).map((r) => r.destination))).sort().slice(0, 12);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Crumbs items={[["Visa checker", "/visa"], [`${passport} passport`, `/visa/from/${slugify(passport)}`], [destination, null]]} />
      <div>
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/55">Entry requirements</p>
        <h1 className="mt-2 font-display text-4xl tracking-tightest text-ink sm:text-5xl">
          {destination} visa for {passport} passport holders
        </h1>
        <p className="mt-4 max-w-2xl font-body text-xl text-ink/85">{answerSentence(lead)}</p>
      </div>

      <section className="rounded-panel bg-paper p-6 shadow-paper">
        <dl className="grid gap-x-8 gap-y-3 font-body text-sm sm:grid-cols-3">
          <div><dt className="text-ink/55">Result</dt><dd className="text-ink">{VISA_TYPE_LABEL[lead.visaType]}</dd></div>
          <div><dt className="text-ink/55">Maximum stay</dt><dd className="text-ink">{lead.maxStayDays ? `${lead.maxStayDays} days` : "Not stated in the source"}</dd></div>
          <div><dt className="text-ink/55">Fee</dt><dd className="text-ink">{lead.feeNotes ?? "Not stated in the source"}</dd></div>
        </dl>
        <p className="mt-4 font-body text-sm leading-relaxed text-ink/80">{lead.conditions}</p>
        <div className="mt-4 border-t border-line pt-3">
          <TrustNotes conditions={lead.conditions} sourceUrl={lead.sourceUrl} verified={lead.verified} passport={passport} destination={destination} heldDocument={lead.requiresDocCountry} />
        </div>
      </section>

      {variants.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-2xl text-ink">If you also hold another visa or permit</h2>
          <p className="font-body text-sm text-ink/75">{destination} treats some {passport} passport holders differently depending on a visa or permit they already have.</p>
          <ul className="space-y-3">
            {variants.map((v) => (
              <li key={v.requiresDocCountry} className="rounded-panel bg-paper p-5 shadow-paper">
                <p className="font-body text-sm text-ink">
                  <strong>With a {docLabel(v.requiresDocCountry!)} visa or permit:</strong> {VISA_TYPE_LABEL[v.visaType]}
                  {v.maxStayDays ? ` · ${v.maxStayDays} days` : ""}
                </p>
                <p className="mt-2 font-body text-sm leading-relaxed text-ink/75">{v.conditions}</p>
                <div className="mt-3 border-t border-line pt-3">
                  <TrustNotes conditions={v.conditions} sourceUrl={v.sourceUrl} verified={v.verified} passport={passport} destination={destination} heldDocument={v.requiresDocCountry} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-panel border border-line p-5">
        <h2 className="font-display text-lg text-ink">Check it against your own documents</h2>
        <p className="mt-1 font-body text-sm text-ink/75">
          Add the visas and permits you hold and NextStamp works out the easiest way in, and warns you before a passport or visa expires.
        </p>
        <Link href="/features/visa-check" className="btn-pill btn-pill-primary mt-3 inline-flex">Run the check</Link>
      </section>

      <section>
        <h2 className="font-display text-lg text-ink">More for {passport} passport holders</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {others.map((d) => (
            <li key={d}><Link className="rounded-full border border-line px-3 py-1 font-body text-sm text-ink/75 hover:text-ink" href={`/visa/${pairSlug(passport, d)}`}>{d}</Link></li>
          ))}
          <li><Link className="rounded-full border border-line px-3 py-1 font-body text-sm text-coral" href={`/visa/from/${slugify(passport)}`}>All destinations</Link></li>
        </ul>
        {cascadeDocuments(rules, passport).length > 0 && (
          <p className="mt-3 font-body text-sm text-ink/75">
            Holding another visa?{" "}
            {cascadeDocuments(rules, passport).map((d, i) => (
              <span key={d}>{i > 0 && ", "}<Link className="text-coral underline" href={`/visa/${cascadeSlug(passport, d)}`}>{passport} + {docLabel(d)}</Link></span>
            ))}
          </p>
        )}
      </section>
      <Disclaimer />
      <JsonLd data={breadcrumbLd([["Visa checker", "/visa"], [`${passport} passport`, `/visa/from/${slugify(passport)}`], [destination, `/visa/${params.slug}`]])} />
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="font-body text-xs text-ink/55">
      Not legal advice, and not a government site. NextStamp does not issue visas or take application fees. Entry rules change; open the official source
      linked above before you book.
    </p>
  );
}

function Crumbs({ items }: { items: [string, string | null][] }) {
  return (
    <nav aria-label="Breadcrumb" className="font-body text-xs text-ink/55">
      {items.map(([label, href], i) => (
        <span key={label}>
          {i > 0 && " / "}
          {href ? <Link href={href} className="hover:text-ink hover:underline">{label}</Link> : <span aria-current="page">{label}</span>}
        </span>
      ))}
    </nav>
  );
}

const breadcrumbLd = (items: [string, string][]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${SITE_URL}${path}` })),
});

function JsonLd({ data }: { data: unknown }) {
  // "<" is escaped so a rule's text can never close the script tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
