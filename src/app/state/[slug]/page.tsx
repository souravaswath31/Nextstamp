import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TerrainHero from "@/components/TerrainHero";
import BackButton from "@/components/BackButton";
import Reveal from "@/components/Reveal";
import { CalendarRange, ThermometerSun, TicketCheck, Backpack } from "lucide-react";

export const dynamic = "force-dynamic";

const CATEGORY_META: Record<string, { title: string; blurb: string }> = {
  amazing: {
    title: "Amazing places",
    blurb: "Hiking, adventure, and the drives worth planning a whole day around.",
  },
  common: {
    title: "The most common places",
    blurb: "The ones everyone visits — for good reason. Book ahead where noted.",
  },
  hidden: {
    title: "Hidden gems",
    blurb: "Off the beaten path — fewer crowds, more effort to reach.",
  },
  food_culture: {
    title: "Food, drink & culture",
    blurb: "What the place actually tastes and sounds like, not just how it looks.",
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
      <div className="-mx-5 overflow-hidden rounded-hero sm:-mx-8">
        <TerrainHero terrain={state.terrain} />
      </div>

      <div className="text-center sm:text-left">
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/45">{state.region}</p>
        <h1 className="mt-2 font-display text-5xl tracking-tightest text-ink sm:text-6xl">{state.name}</h1>
        <p className="mt-3 font-body text-xl text-ink/60">{state.heroTagline}</p>
        <p className="mx-auto mt-3 max-w-2xl font-body text-base text-ink/70 sm:mx-0">{state.heroDescription}</p>
      </div>

      <section className="grid gap-6 rounded-panel bg-paper p-6 shadow-paper sm:grid-cols-2">
        <div className="flex gap-2.5">
          <CalendarRange size={16} className="mt-0.5 shrink-0 text-coralDark" />
          <div>
            <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">Best time to visit</p>
            <p className="mt-1 font-body text-sm text-ink/80">{state.bestTimeToVisit}</p>
          </div>
        </div>
        {state.altitudeOrClimateNote && (
          <div className="flex gap-2.5">
            <ThermometerSun size={16} className="mt-0.5 shrink-0 text-stamp" />
            <div>
              <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">Know before you go</p>
              <p className="mt-1 font-body text-sm text-ink/80">{state.altitudeOrClimateNote}</p>
            </div>
          </div>
        )}
        {state.permitsNote && (
          <div className="flex gap-2.5">
            <TicketCheck size={16} className="mt-0.5 shrink-0 text-teal" />
            <div>
              <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">Permits & reservations</p>
              <p className="mt-1 font-body text-sm text-ink/80">{state.permitsNote}</p>
            </div>
          </div>
        )}
        {state.gearNote && (
          <div className="flex gap-2.5">
            <Backpack size={16} className="mt-0.5 shrink-0 text-forest" />
            <div>
              <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">What to bring</p>
              <p className="mt-1 font-body text-sm text-ink/80">{state.gearNote}</p>
            </div>
          </div>
        )}
      </section>

      {(["amazing", "common", "hidden", "food_culture"] as const).map((cat) => {
        const places = byCategory(cat);
        if (places.length === 0) return null;
        const meta = CATEGORY_META[cat];
        return (
          <Reveal key={cat}>
            <section>
              <h2 className="font-display text-2xl text-ink">{meta.title}</h2>
              <p className="mt-1 font-body text-sm text-ink/55">{meta.blurb}</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {places.map((p) => (
                  <div key={p.id} className="card-lift rounded-panel bg-paper p-5 shadow-paper">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-display text-base text-ink">{p.name}</h3>
                      {p.placeType && (
                        <span className="whitespace-nowrap font-stamp text-[10px] uppercase text-ink/40">
                          {PLACE_TYPE_LABEL[p.placeType] ?? p.placeType}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 font-body text-sm text-ink/65">{p.description}</p>
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
          </Reveal>
        );
      })}
    </div>
  );
}
