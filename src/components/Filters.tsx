"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
    <div className="space-y-4 border border-line bg-paper p-4">
      <div>
        <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">Category</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`rounded-full border px-2.5 py-1 font-body text-xs font-medium ${
                activeCategories.includes(cat)
                  ? CATEGORY_FILLED_CLASSES[cat]
                  : "border-line text-ink/70 hover:border-ink"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">
            Region
          </span>
          <select
            value={activeRegion}
            onChange={(e) => update("region", e.target.value)}
            className="border border-line bg-paper px-2 py-1 font-body text-sm text-ink"
          >
            <option value="">Any</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">
            Budget
          </span>
          <select
            value={activeCostTier}
            onChange={(e) => update("cost", e.target.value)}
            className="border border-line bg-paper px-2 py-1 font-body text-sm text-ink"
          >
            <option value="">Any</option>
            {COST_TIERS.map((c) => (
              <option key={c} value={c}>
                {c[0].toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">
            Visa ease
          </span>
          <select
            value={activeVisaEase}
            onChange={(e) => update("visa", e.target.value)}
            className="border border-line bg-paper px-2 py-1 font-body text-sm text-ink"
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
