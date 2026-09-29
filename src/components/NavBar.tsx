"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Compass, Map, Luggage, UserRound, LayoutGrid, LogIn, Globe2 } from "lucide-react";

// Explore, States and Guides are the free browsable library — no login needed.
// Dashboard/My Trips/Profile are personal, so a logged-out visitor gets
// "Sign in" instead of three tabs that would just redirect there anyway.
const PUBLIC_TABS = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/states", label: "States", icon: Map },
  { href: "/countries", label: "Guides", icon: Globe2 },
];
// My Trips sits second, directly after the dashboard. It used to be fifth of
// six, behind three browse tabs — so the thing a returning user comes back for
// was further away than the things they'd already looked at. Browsing is what
// you do once; your trips are what you return to.
const PRIVATE_TABS = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/my-trips", label: "My Trips", icon: Luggage },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/states", label: "States", icon: Map },
  { href: "/countries", label: "Guides", icon: Globe2 },
  { href: "/profile", label: "Profile", icon: UserRound },
];

// A 375px tab bar fits about five items legibly. The signed-out set is three
// plus "Sign in", so everything fits; the signed-in set is six, so one has to
// go, and Guides is the one with the most other ways in (the dashboard card,
// every itinerary's visa section, and every trip's destination). The desktop
// bar has room and always shows everything.
const MOBILE_TAB_LIMIT = 5;

const AUTH_ROUTES = ["/login", "/onboarding"];

export default function NavBar({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname();

  if (AUTH_ROUTES.includes(pathname)) return null;

  const TABS = isAuthenticated ? PRIVATE_TABS : PUBLIC_TABS;
  // "Sign in" takes a slot of its own in the mobile bar when signed out.
  const mobileBudget = MOBILE_TAB_LIMIT - (isAuthenticated ? 0 : 1);
  const MOBILE_TABS =
    TABS.length <= mobileBudget ? TABS : TABS.filter((t) => t.href !== "/countries");

  return (
    <>
      {/* Top bar — apple.com style: slim, translucent, small text-only links */}
      <header className="sticky top-0 z-20 border-b border-black/5 bg-paper/75 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center">
            <Image src="/logo.png" alt="NextStamp" width={104} height={28} priority className="h-6 w-auto" />
          </Link>
          <nav className="hidden items-center gap-7 sm:flex">
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
            {!isAuthenticated && (
              <Link href="/login" className="btn-pill btn-pill-primary !px-4 !py-1.5 !text-xs">
                <LogIn size={13} /> Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Bottom tabs — iOS-style tab bar, thumb-reachable on mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-paper/90 backdrop-blur-xl sm:hidden">
        <div className="mx-auto flex max-w-6xl justify-around px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5">
          {MOBILE_TABS.map((tab) => {
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
          {!isAuthenticated && (
            <Link
              href="/login"
              className="flex flex-1 flex-col items-center gap-0.5 rounded-card px-2 py-1 text-center font-body text-[10px] text-coral"
            >
              <LogIn size={22} strokeWidth={1.8} />
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
