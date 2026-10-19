import type { Metadata } from "next";
import Link from "next/link";
import { getCachedRules } from "@/lib/visaPagesData";
import { passportsIn } from "@/lib/visaPages";
import { slugify } from "@/lib/slug";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Visa requirements by passport — NextStamp",
  description: "Pick a passport to see what it needs for every destination we cover, each answer with its official source and the date we checked it.",
  alternates: { canonical: "/visa" },
};

export default async function VisaHub() {
  const rules = await getCachedRules();
  const passports = passportsIn(rules);
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/55">Visa checker</p>
        <h1 className="mt-2 font-display text-4xl tracking-tightest text-ink sm:text-5xl">Visa requirements by passport</h1>
        <p className="mt-4 max-w-2xl font-body text-lg text-ink/75">
          Choose a passport. Every answer shows the official page it came from and the day we checked it, and tells you when a rule is
          ageing, about to end, or leaves details open.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {passports.map((p) => (
          <li key={p}>
            <Link href={`/visa/from/${slugify(p)}`} className="block rounded-panel bg-paper p-5 shadow-paper hover:bg-paperDark">
              <span className="font-display text-xl text-ink">{p} passport</span>
              <span className="mt-1 block font-body text-sm text-ink/65">{new Set(rules.filter((r) => r.passport === p).map((r) => r.destination)).size} destinations</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="font-body text-sm text-ink/75">
        Not listed? <Link className="text-coral underline" href="/features/visa-check">Ask for your passport</Link>. We add passports we can source from official pages.
      </p>
    </div>
  );
}
