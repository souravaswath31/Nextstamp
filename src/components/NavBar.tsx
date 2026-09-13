"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Map, Luggage, UserRound, LayoutGrid } from "lucide-react";

const TABS = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/states", label: "States", icon: Map },
  { href: "/my-trips", label: "My Trips", icon: Luggage },
  { href: "/profile", label: "Profile", icon: UserRound },
];

const AUTH_ROUTES = ["/login", "/onboarding"];

export default function NavBar() {
  const pathname = usePathname();

  if (AUTH_ROUTES.includes(pathname)) return null;

  return (
    <>
      {/* Top bar — wordmark + full nav on larger screens */}
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2 font-display text-xl tracking-tight text-ink">
            <span className="stamp-mark flex h-8 w-8 items-center justify-center border-coral text-coral">
              <span className="font-stamp text-sm font-bold not-italic">N</span>
            </span>
            Next<span className="text-coral">Stamp</span>
          </Link>
          <nav className="hidden gap-1 sm:flex">
            {TABS.map((tab) => {
              const active = pathname === tab.href;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 font-body text-sm transition-colors ${
                    active
                      ? "bg-coral/10 font-medium text-coralDark"
                      : "text-ink/60 hover:bg-ink/5 hover:text-ink"
                  }`}
                >
                  <Icon size={15} strokeWidth={2} />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Bottom tabs — thumb-reachable on mobile, hidden on larger screens */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur-sm shadow-paper sm:hidden">
        <div className="mx-auto flex max-w-5xl justify-around px-2 py-1.5">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-card px-2 py-1.5 text-center font-body text-[11px] transition-colors ${
                  active ? "font-semibold text-coral" : "text-ink/50"
                }`}
              >
                <Icon size={19} strokeWidth={active ? 2.4 : 2} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
