"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function StatesFilters({ regions }: { regions: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeRegion = searchParams.get("region") ?? "";
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  // Debounce the text search so we're not pushing a new URL on every
  // keystroke — this still updates the URL (so the filtered view is
  // shareable/bookmarkable and survives a back-navigation), just not
  // instantly on each character.
  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) params.set("q", q);
      else params.delete("q");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function updateRegion(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("region", value);
    else params.delete("region");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search states…"
        className="min-w-[200px] flex-1 border border-line bg-paper px-3 py-2 font-body text-sm text-ink placeholder:text-ink/40 focus:border-ink focus:outline-none"
      />
      <select
        value={activeRegion}
        onChange={(e) => updateRegion(e.target.value)}
        className="border border-line bg-paper px-3 py-2 font-body text-sm text-ink focus:border-ink focus:outline-none"
      >
        <option value="">All regions</option>
        {regions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );
}
