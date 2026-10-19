"use client";

import { usePathname } from "next/navigation";
import NavBar from "./NavBar";
import Footer from "./Footer";
import { useHasSession } from "./useHasSession";

// Pages that lay out their own full-width sections. Everything else — the app, the
// itinerary and guide pages — sits in a padded column. (The whole UI is dark either way.) "/" is marketing
// only for a logged-out visitor; signed in, it is the dashboard.
const MARKETING_PREFIXES = ["/features", "/pricing", "/flights", "/hotels", "/activities", "/about"];

// "/" is always laid out full-bleed: the landing page is built that way and the dashboard pads itself,
// so the server never needs to know who is looking.
export function isMarketingPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return MARKETING_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthenticated = useHasSession();
  // Marketing pages lay out their own full-width sections; app pages sit in a padded column.
  const fullBleed = isMarketingPath(pathname);

  return (
    <div className="flex flex-1 flex-col bg-night text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-night"
      >
        Skip to content
      </a>
      <NavBar isAuthenticated={isAuthenticated} />
      {fullBleed ? (
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
      ) : (
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-5 pb-28 pt-8 focus:outline-none sm:px-8 sm:pt-10">
          {children}
        </main>
      )}
      <Footer />
    </div>
  );
}
