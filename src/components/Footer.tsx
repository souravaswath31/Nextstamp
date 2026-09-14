"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const AUTH_ROUTES = ["/login", "/onboarding"];

export default function Footer() {
  const pathname = usePathname();

  if (AUTH_ROUTES.includes(pathname)) return null;

  return (
    <footer className="mt-20 border-t border-black/5">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-8 text-center sm:flex-row sm:justify-between sm:px-8 sm:text-left">
        <p className="font-body text-xs text-ink/40">
          © {new Date().getFullYear()} NextStamp. Not a substitute for official immigration advice.
        </p>
        <nav className="flex gap-5 font-body text-xs text-ink/50">
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
