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
    <div className="space-y-10">
      <div className="text-center sm:text-left">
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/45">
          Destination guides
        </p>
        <h1 className="mt-2 font-display text-5xl tracking-tightest text-ink sm:text-6xl">Explore by state</h1>
        <p className="mx-auto mt-3 max-w-xl font-body text-base text-ink/55 sm:mx-0">
          Everything worth knowing about a state, organized so you can plan your own
          trip — the amazing places, the ones everyone visits, and the ones almost
          nobody finds. Starting with the USA, one state at a time.
        </p>
      </div>

      <StatesFilters regions={regions} />

      <div className="grid gap-5 sm:grid-cols-2">
        {states.map((s) => (
          <Link
            key={s.id}
            href={`/state/${s.slug}`}
            className="card-lift group block overflow-hidden rounded-panel bg-paper shadow-paper"
          >
            <TerrainHero terrain={s.terrain} />
            <div className="p-5">
              <h2 className="font-display text-xl text-ink">{s.name}</h2>
              <p className="mt-1 font-body text-sm text-ink/60">{s.heroTagline}</p>
              <p className="mt-1.5 font-stamp text-[11px] uppercase tracking-wide text-ink/35">{s.region}</p>
            </div>
          </Link>
        ))}
      </div>

      {states.length === 0 ? (
        <p className="rounded-panel bg-paperDark px-5 py-4 font-body text-sm text-ink/60">
          {allStates.length === 0
            ? "No state guides yet — check back soon."
            : "No states match that search — try a different term or clear the region filter."}
        </p>
      ) : (
        <p className="rounded-panel bg-paperDark px-5 py-4 font-body text-xs text-ink/55">
          Showing {states.length} of {allStates.length} state{allStates.length === 1 ? "" : "s"} covered so far — more added regularly.
        </p>
      )}
    </div>
  );
}
