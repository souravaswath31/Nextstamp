"use client";

import Link from "next/link";
import Image from "next/image";
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
      {/* Top bar — apple.com style: slim, translucent, small text-only links */}
      <header className="sticky top-0 z-20 border-b border-black/5 bg-paper/75 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center">
            <Image src="/logo.png" alt="NextStamp" width={104} height={28} priority className="h-6 w-auto" />
          </Link>
          <nav className="hidden gap-7 sm:flex">
            {TABS.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`font-body text-[12.5px] transition-colors ${
                    active ? "font-medium text-ink" : "text-ink/60 hover:text-ink"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Bottom tabs — iOS-style tab bar, thumb-reachable on mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-paper/90 backdrop-blur-xl sm:hidden">
        <div className="mx-auto flex max-w-6xl justify-around px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-card px-2 py-1 text-center font-body text-[10px] transition-colors ${
                  active ? "font-medium text-coral" : "text-ink/45"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
