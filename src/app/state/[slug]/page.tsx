import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TerrainHero from "@/components/TerrainHero";
import BackButton from "@/components/BackButton";

export const dynamic = "force-dynamic";

const CATEGORY_META: Record<string, { title: string; blurb: string; colorClass: string }> = {
  amazing: {
    title: "Amazing places",
    blurb: "Hiking, adventure, and the drives worth planning a whole day around.",
    colorClass: "border-t-catNature",
  },
  common: {
    title: "The most common places",
    blurb: "The ones everyone visits — for good reason. Book ahead where noted.",
    colorClass: "border-t-catCity",
  },
  hidden: {
    title: "Hidden gems",
    blurb: "Off the beaten path — fewer crowds, more effort to reach.",
    colorClass: "border-t-catBeaten",
  },
  food_culture: {
    title: "Food, drink & culture",
    blurb: "What the place actually tastes and sounds like, not just how it looks.",
    colorClass: "border-t-catSplurge",
  },
};

const PLACE_TYPE_LABEL: Record<string, string> = {
  hike: "Hike",
  drive: "Scenic drive",
  attraction: "Attraction",
  town: "Town",
  park: "Park",
  dish: "Dish",
  drink: "Drink",
  tradition: "Tradition",
  culture: "Culture",
};

export default async function StateGuidePage({ params }: { params: { slug: string } }) {
  const state = await prisma.stateGuide.findUnique({
    where: { slug: params.slug },
    include: { places: { orderBy: { sortOrder: "asc" } } },
  });

  if (!state) notFound();

  const byCategory = (cat: string) => state.places.filter((p) => p.category === cat);

  return (
    <div className="space-y-10">
      <BackButton label="Back to States" />
      <div className="-mx-5 sm:-mx-8">
        <TerrainHero terrain={state.terrain} />
      </div>

      <div>
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/50">{state.region}</p>
        <h1 className="mt-1 font-display text-3xl text-ink sm:text-4xl">{state.name}</h1>
        <p className="mt-2 font-body text-lg italic text-ink/70">{state.heroTagline}</p>
        <p className="mt-3 max-w-2xl font-body text-sm text-ink/80">{state.heroDescription}</p>
      </div>

      <section className="grid gap-4 border border-line p-5 sm:grid-cols-2">
        <div>
          <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">Best time to visit</p>
          <p className="mt-1 font-body text-sm text-ink/80">{state.bestTimeToVisit}</p>
        </div>
        {state.altitudeOrClimateNote && (
          <div>
            <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">Know before you go</p>
            <p className="mt-1 font-body text-sm text-ink/80">{state.altitudeOrClimateNote}</p>
          </div>
        )}
        {state.permitsNote && (
          <div>
            <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">Permits & reservations</p>
            <p className="mt-1 font-body text-sm text-ink/80">{state.permitsNote}</p>
          </div>
        )}
        {state.gearNote && (
          <div>
            <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">What to bring</p>
            <p className="mt-1 font-body text-sm text-ink/80">{state.gearNote}</p>
          </div>
        )}
      </section>

      {(["amazing", "common", "hidden", "food_culture"] as const).map((cat) => {
        const places = byCategory(cat);
        if (places.length === 0) return null;
        const meta = CATEGORY_META[cat];
        return (
          <section key={cat}>
            <h2 className="font-display text-2xl text-ink">{meta.title}</h2>
            <p className="mt-1 font-body text-sm text-ink/60">{meta.blurb}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {places.map((p) => (
                <div key={p.id} className={`border border-line border-t-[3px] bg-paper p-4 ${meta.colorClass}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-base text-ink">{p.name}</h3>
                    {p.placeType && (
                      <span className="whitespace-nowrap font-stamp text-[10px] uppercase text-ink/40">
                        {PLACE_TYPE_LABEL[p.placeType] ?? p.placeType}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 font-body text-sm text-ink/75">{p.description}</p>
                  {p.tip && (
                    <p className="mt-2 font-body text-xs text-coralDark">
                      Tip: {p.tip}
                    </p>
                  )}
                  {p.nearestTown && (
                    <p className="mt-1 font-body text-xs text-ink/40">Near {p.nearestTown}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
