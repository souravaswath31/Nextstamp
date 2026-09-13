"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_FILLED_CLASSES } from "@/lib/types";

const CATEGORIES = Object.keys(CATEGORY_LABELS);
const COST_TIERS = ["budget", "mid", "splurge"];
const VISA_EASE = [
  { value: "", label: "Any" },
  { value: "easy", label: "Visa-free / on arrival / resident" },
  { value: "advance", label: "Needs e-visa or advance visa" },
];

export default function Filters({
  regions,
}: {
  regions: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeCategories = searchParams.get("category")?.split(",").filter(Boolean) ?? [];
  const activeRegion = searchParams.get("region") ?? "";
  const activeCostTier = searchParams.get("cost") ?? "";
  const activeVisaEase = searchParams.get("visa") ?? "";

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleCategory(cat: string) {
    const next = activeCategories.includes(cat)
      ? activeCategories.filter((c) => c !== cat)
      : [...activeCategories, cat];
    update("category", next.join(","));
  }

  return (
    <div className="space-y-5 rounded-panel bg-paper p-5 shadow-paper sm:p-6">
      <div>
        <p className="flex items-center gap-1.5 font-stamp text-[11px] uppercase tracking-wide text-ink/45">
          <SlidersHorizontal size={12} /> Category
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`rounded-full px-3 py-1.5 font-body text-xs font-medium transition-colors ${
                activeCategories.includes(cat)
                  ? CATEGORY_FILLED_CLASSES[cat]
                  : "bg-paperDark text-ink/70 hover:bg-line/60"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
            Region
          </span>
          <select
            value={activeRegion}
            onChange={(e) => update("region", e.target.value)}
            className="rounded-card bg-paperDark px-3 py-1.5 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
          >
            <option value="">Any</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
            Budget
          </span>
          <select
            value={activeCostTier}
            onChange={(e) => update("cost", e.target.value)}
            className="rounded-card bg-paperDark px-3 py-1.5 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
          >
            <option value="">Any</option>
            {COST_TIERS.map((c) => (
              <option key={c} value={c}>
                {c[0].toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
            Visa ease
          </span>
          <select
            value={activeVisaEase}
            onChange={(e) => update("visa", e.target.value)}
            className="rounded-card bg-paperDark px-3 py-1.5 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
          >
            {VISA_EASE.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
