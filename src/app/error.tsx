"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

// Shown when a page throws (a database hiccup, a failed action). The digest lets the
// owner match a report to the server log; nothing technical is shown to the visitor.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[page error]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="stamp-mark flex h-16 w-16 items-center justify-center border-stampRed text-stampRed">
        <TriangleAlert size={26} />
      </span>
      <h1 className="mt-5 font-display text-4xl tracking-tightest text-ink">That didn&apos;t work</h1>
      <p className="mt-3 max-w-sm font-body text-sm text-ink/65">
        Something went wrong on our side. Your trips and documents are safe. Try again, and if it keeps happening, come
        back in a few minutes.
      </p>
      {error.digest && <p className="mt-2 font-stamp text-xs text-ink/55">Reference: {error.digest}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-pill btn-pill-primary">
          Try again
        </button>
        <Link href="/" className="btn-pill">
          Back to NextStamp
        </Link>
      </div>
    </div>
  );
}
