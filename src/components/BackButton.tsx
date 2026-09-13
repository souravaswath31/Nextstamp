"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Uses router.back() rather than a static Link to a fixed URL — this way
// returning from a state guide preserves whatever search/region filter and
// scroll position was active on the list page, instead of dumping the
// person back at an unfiltered top-of-page every time.
export default function BackButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 font-body text-sm text-ink/60 transition-colors hover:text-ink"
    >
      <ArrowLeft size={15} /> {label}
    </button>
  );
}
