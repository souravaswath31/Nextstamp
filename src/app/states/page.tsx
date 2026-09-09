import Link from "next/link";
import { prisma } from "@/lib/prisma";
import TerrainHero from "@/components/TerrainHero";
import StatesFilters from "@/components/StatesFilters";

export const dynamic = "force-dynamic";

export default async function StatesPage({
  searchParams,
}: {
  searchParams: { q?: string; region?: string };
}) {
  const allStates = await prisma.stateGuide.findMany({ orderBy: { name: "asc" } });
  const regions = Array.from(new Set(allStates.map((s) => s.region))).sort();

  const q = (searchParams.q ?? "").trim().toLowerCase();
  const region = searchParams.region ?? "";
  const states = allStates.filter((s) => {
    const matchesQuery = !q || s.name.toLowerCase().includes(q) || s.heroTagline.toLowerCase().includes(q);
    const matchesRegion = !region || s.region === region;
    return matchesQuery && matchesRegion;
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/50">
          Destination guides
        </p>
        <h1 className="mt-1 font-display text-3xl text-ink">Explore by state</h1>
        <p className="mt-2 max-w-xl font-body text-sm text-ink/60">
          Everything worth knowing about a state, organized so you can plan your own
          trip — the amazing places, the ones everyone visits, and the ones almost
          nobody finds. Starting with the USA, one state at a time.
        </p>
      </div>

      <StatesFilters regions={regions} />

      <div className="grid gap-4 sm:grid-cols-2">
        {states.map((s) => (
          <Link
            key={s.id}
            href={`/state/${s.slug}`}
            className="group block overflow-hidden border border-line bg-paper transition-colors hover:border-ink"
          >
            <TerrainHero terrain={s.terrain} />
            <div className="p-4">
              <h2 className="font-display text-xl text-ink group-hover:underline">{s.name}</h2>
              <p className="mt-1 font-body text-sm text-ink/70">{s.heroTagline}</p>
              <p className="mt-1 font-stamp text-[11px] uppercase tracking-wide text-ink/40">{s.region}</p>
            </div>
          </Link>
        ))}
      </div>

      {states.length === 0 ? (
        <p className="border border-line bg-paperDark px-4 py-3 font-body text-sm text-ink/60">
          {allStates.length === 0
            ? "No state guides yet — check back soon."
            : "No states match that search — try a different term or clear the region filter."}
        </p>
      ) : (
        <p className="border border-line bg-paperDark px-4 py-3 font-body text-xs text-ink/60">
          Showing {states.length} of {allStates.length} state{allStates.length === 1 ? "" : "s"} covered so far — more added regularly.
        </p>
      )}
    </div>
  );
}
