import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

export const SECTION = "mx-auto w-full max-w-6xl px-5 sm:px-8";
export const EYEBROW = "font-stamp text-[11px] uppercase tracking-widest text-white/45";

export function PageHeader({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className={`${SECTION} pb-12 pt-12 sm:pt-16`}>
      <p className={EYEBROW}>{eyebrow}</p>
      <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] tracking-tightest text-white sm:text-5xl">
        {title}
      </h1>
      {lead && <p className="mt-5 max-w-2xl font-body text-lg leading-relaxed text-white/65">{lead}</p>}
      {children}
    </header>
  );
}

export function Block({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-white/10">
      <div className={`${SECTION} py-12 sm:py-14`}>
        <h2 className="max-w-2xl font-display text-2xl tracking-tightest text-white sm:text-3xl">{title}</h2>
        <div className="mt-5 max-w-2xl space-y-4 font-body text-[15px] leading-relaxed text-white/65">{children}</div>
      </div>
    </section>
  );
}

export function CtaLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="btn-pill btn-pill-accent">
      {children} <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}

export const NOT_LEGAL_ADVICE =
  "Not legal or immigration advice. Visa rules change, and a rule here can be out of date or not fit your situation. Confirm with the destination's official source before you book.";
