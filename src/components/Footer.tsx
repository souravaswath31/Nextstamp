"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const AUTH_ROUTES = ["/login", "/onboarding"];

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/features/visa-check", label: "Passport and visa check" },
      { href: "/visa", label: "Visa requirements by passport" },
      { href: "/features/trip-from-a-link", label: "Trip from a link" },
      { href: "/escape", label: "Escape Hatch (group trip game)" },
      { href: "/wallet", label: "Trip fund" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Itineraries",
    links: [
      { href: "/explore", label: "All itineraries" },
      { href: "/flights", label: "Flights" },
      { href: "/hotels", label: "Hotels" },
      { href: "/activities", label: "Activities" },
    ],
  },
  {
    title: "Destinations",
    links: [
      { href: "/states", label: "US state guides" },
      { href: "/countries", label: "Country guides" },
    ],
  },
  {
    title: "Company and trust",
    links: [
      { href: "/about", label: "About" },
      { href: "/features/visa-check#sources", label: "How we source visa rules" },
      { href: "/contact", label: "Contact" },
      { href: "/terms", label: "Terms (draft)" },
      { href: "/privacy", label: "Privacy (draft)" },
    ],
  },
];

export default function Footer() {
  const pathname = usePathname();
  if (AUTH_ROUTES.includes(pathname)) return null;

  const muted = "text-ink/55";
  const strong = "text-ink/85";
  const hover = "hover:text-ink";

  return (
    <footer className="mt-20 border-t border-white/10">
      <div className="mx-auto max-w-6xl px-5 pb-28 pt-12 sm:px-8 sm:pb-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="font-stamp text-[11px] uppercase tracking-widest text-ink/55">
                {col.title}
              </p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={`font-body text-sm ${muted} ${hover}`}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className={`mt-10 space-y-2 border-t border-white/10 pt-6 font-body text-xs ${muted}`}>
          <p className={strong}>
            NextStamp is not legal or immigration advice. Visa rules change, and a rule here can be
            out of date or not fit your situation. Confirm with the destination&apos;s official
            source before you book.
          </p>
          <p>NextStamp does not book or sell travel.</p>
          <p>© {new Date().getFullYear()} NextStamp</p>
        </div>
      </div>
    </footer>
  );
}
