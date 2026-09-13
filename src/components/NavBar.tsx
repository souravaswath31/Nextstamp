"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Dashboard" },
  { href: "/explore", label: "Explore" },
  { href: "/states", label: "States" },
  { href: "/my-trips", label: "My Trips" },
  { href: "/profile", label: "Profile" },
];

const AUTH_ROUTES = ["/login", "/onboarding"];

export default function NavBar() {
  const pathname = usePathname();

  if (AUTH_ROUTES.includes(pathname)) return null;

  return (
    <>
      {/* Top bar — wordmark + full nav on larger screens */}
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-1.5 font-display text-xl tracking-tight text-ink">
            Next<span className="text-coral">Stamp</span>
          </Link>
          <nav className="hidden gap-6 sm:flex">
            {TABS.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`font-body text-sm ${
                    active
                      ? "text-ink font-medium underline decoration-coral decoration-2 underline-offset-8"
                      : "text-ink/60 hover:text-ink"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Bottom tabs — thumb-reachable on mobile, hidden on larger screens */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper sm:hidden">
        <div className="mx-auto flex max-w-5xl justify-around px-2 py-2">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 rounded-card px-2 py-1.5 text-center font-body text-xs ${
                  active ? "font-semibold text-coral" : "text-ink/50"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
