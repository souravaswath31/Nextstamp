"use client";

import { usePathname } from "next/navigation";
import NavBar from "./NavBar";
import Footer from "./Footer";

// Pages that use the dark marketing look. Everything else — the app, the
// itinerary and guide pages — keeps the light design system. "/" is marketing
// only for a logged-out visitor; signed in, it is the dashboard.
const MARKETING_PREFIXES = ["/features", "/pricing", "/flights", "/hotels", "/activities", "/about"];

export function isMarketingPath(pathname: string, isAuthenticated: boolean): boolean {
  if (pathname === "/") return !isAuthenticated;
  return MARKETING_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function Chrome({
  isAuthenticated,
  children,
}: {
  isAuthenticated: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const dark = isMarketingPath(pathname, isAuthenticated);

  return (
    <div className={`flex flex-1 flex-col ${dark ? "bg-night text-bone" : ""}`}>
      <NavBar isAuthenticated={isAuthenticated} dark={dark} />
      {dark ? (
        <main className="flex-1">{children}</main>
      ) : (
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-28 pt-8 sm:px-8 sm:pt-10">
          {children}
        </main>
      )}
      <Footer dark={dark} />
    </div>
  );
}
