"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Search } from "lucide-react";

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
      <div className="relative min-w-[200px] flex-1">
        <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search states…"
          className="w-full rounded-full bg-paperDark py-2.5 pl-10 pr-4 font-body text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
        />
      </div>
      <select
        value={activeRegion}
        onChange={(e) => updateRegion(e.target.value)}
        className="rounded-full bg-paperDark px-4 py-2.5 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
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
