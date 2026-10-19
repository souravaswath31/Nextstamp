import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCachedRules } from "@/lib/visaPagesData";
import { cascadeDocuments, cascadeSlug, docLabel, pairSlug, passportsIn } from "@/lib/visaPages";
import { slugify } from "@/lib/slug";
import { VISA_TYPE_LABEL, type PublicRule } from "@/lib/passportCheck";

export const revalidate = 3600;
export async function generateStaticParams() {
  return [];
}

async function load(slug: string) {
  const rules = await getCachedRules();
  const passport = passportsIn(rules).find((p) => slugify(p) === slug);
  return { rules, passport };
}

export async function generateMetadata({ params }: { params: { passport: string } }): Promise<Metadata> {
  const { passport } = await load(params.passport);
  if (!passport) return { robots: { index: false } };
  return {
    title: `Visa requirements for ${passport} passport holders — NextStamp`,
    description: `What a ${passport} passport needs for every destination we cover, with the official source and the date each rule was checked.`,
    alternates: { canonical: `/visa/from/${params.passport}` },
  };
}

const ORDER: PublicRule["visaType"][] = ["visa-free", "visa-on-arrival", "e-visa", "advance-visa-required"];

export default async function FromPassport({ params }: { params: { passport: string } }) {
  const { rules, passport } = await load(params.passport);
  if (!passport) notFound();
  const base = rules.filter((r) => r.passport === passport && !r.requiresDocCountry);
  const docs = cascadeDocuments(rules, passport);
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <nav aria-label="Breadcrumb" className="font-body text-xs text-ink/55">
        <Link href="/visa" className="hover:text-ink hover:underline">Visa checker</Link> / <span aria-current="page">{passport} passport</span>
      </nav>
      <div>
        <h1 className="font-display text-4xl tracking-tightest text-ink sm:text-5xl">Visa requirements for {passport} passport holders</h1>
        <p className="mt-4 max-w-2xl font-body text-lg text-ink/75">
          {base.length} destinations, grouped by what the passport alone needs. Open one for the conditions, the official source and the date it was checked.
        </p>
      </div>
      {docs.length > 0 && (
        <section className="rounded-panel border border-line p-5">
          <h2 className="font-display text-lg text-ink">Hold another visa or permit?</h2>
          <p className="mt-1 font-body text-sm text-ink/75">Some destinations ease entry if you already hold one of these:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {docs.map((d) => (
              <li key={d}><Link className="rounded-full border border-line px-3 py-1 font-body text-sm text-coral" href={`/visa/${cascadeSlug(passport, d)}`}>{passport} + {docLabel(d)}</Link></li>
            ))}
          </ul>
        </section>
      )}
      {ORDER.map((t) => {
        const group = base.filter((r) => r.visaType === t).sort((a, b) => a.destination.localeCompare(b.destination));
        if (group.length === 0) return null;
        return (
          <section key={t}>
            <h2 className="font-display text-2xl text-ink">{VISA_TYPE_LABEL[t]} <span className="text-base text-ink/55">({group.length})</span></h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {group.map((r) => (
                <li key={r.destination}>
                  <Link href={`/visa/${pairSlug(passport, r.destination)}`} className="flex items-baseline justify-between gap-3 rounded-card bg-paper px-4 py-3 shadow-paper hover:bg-paperDark">
                    <span className="font-body text-sm text-ink">{r.destination}</span>
                    <span className="font-body text-xs text-ink/65">{r.maxStayDays ? `${r.maxStayDays} days` : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="font-body text-xs text-ink/55">Not legal advice, and not a government site. Confirm with the official source before you book.</p>
    </div>
  );
}
