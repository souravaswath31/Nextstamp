import { ExternalLink, UtensilsCrossed, CalendarClock, Backpack } from "lucide-react";
import {
  KIND_LABELS,
  MEAL_LABELS,
  eatFreshness,
  formatDayRange,
  hoursNoteTone,
  type EatGroup,
} from "@/lib/roadEats";
import AddToTripButton, { type TripOption } from "./AddToTripButton";

/**
 * "Eat along the route" — the food a road-tripper actually needs.
 *
 * The state guides tell you what a place TASTES like (green chile, Palisade
 * peaches). They don't tell you where to stop on Day 3, which is what a
 * road-trip's food question really is. This is grouped by where you are on the
 * route, not by cuisine, and each eat carries the evidence and date behind it.
 *
 * Restaurants are the most perishable thing in this app: they close, go
 * seasonal and change hours. So the section says that out loud, shows how old
 * each check is, and surfaces any stated closing days or seasons prominently
 * rather than burying them — a traveller sent to a shuttered shack in February
 * has been actively let down by us.
 */
export default function RoadEats({
  groups,
  heading = "Eat along the route",
  trips = [],
  isSignedIn = false,
  sourceSlugForSave = null,
}: {
  groups: EatGroup[];
  heading?: string;
  trips?: TripOption[];
  isSignedIn?: boolean;
  sourceSlugForSave?: string | null;
}) {
  if (groups.length === 0) return null;

  return (
    <section>
      <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
        <UtensilsCrossed size={21} className="text-ink/35" /> {heading}
      </h2>
      <p className="mt-1 max-w-2xl font-body text-sm text-ink/55">
        A few real stops in each town you&apos;ll be passing through, picked for being local
        rather than famous. Each was checked against a current source — shown on every one.
        Restaurants change hours and close, so confirm before you drive out of your way.
      </p>

      <div className="mt-6 space-y-9">
        {groups.map((group) => {
          const fresh = eatFreshness(group.stop.lastVerifiedDate);
          return (
            <div key={group.town}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="font-display text-xl text-ink">
                  <span className="font-stamp text-[11px] uppercase tracking-widest text-ink/40">
                    {formatDayRange(group.dayNumbers)}
                  </span>
                  <span className="mx-2 text-ink/20">·</span>
                  {group.town}
                </h3>
                <p
                  className={`flex items-center gap-1 font-body text-[11px] ${
                    fresh.level === "fresh"
                      ? "text-ink/40"
                      : fresh.level === "aging"
                        ? "text-stamp"
                        : "font-semibold text-stampRed"
                  }`}
                >
                  <CalendarClock size={11} /> {fresh.label}
                </p>
              </div>

              {/* The thin-options note: the honest answer in remote places. */}
              {group.stop.note && (
                <p className="mt-2.5 flex items-start gap-2 rounded-card bg-stamp/[0.07] px-3.5 py-2.5 font-body text-sm text-ink/75">
                  <Backpack size={15} className="mt-0.5 shrink-0 text-stamp" />
                  <span>
                    {group.stop.note}
                    {group.stop.noteSourceUrl && (
                      <>
                        {" "}
                        <a
                          href={group.stop.noteSourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="whitespace-nowrap text-[11px] font-semibold text-ink/45 hover:text-coralDark hover:underline"
                        >
                          Source
                        </a>
                      </>
                    )}
                  </span>
                </p>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {group.stop.eats.map((eat) => (
                  <div key={eat.id} className="card-lift flex flex-col rounded-panel bg-paper p-5 shadow-paper">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-coral/10 px-2 py-0.5 font-body text-[11px] font-semibold text-coralDark">
                        {MEAL_LABELS[eat.meal] ?? eat.meal}
                      </span>
                      <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 font-body text-[11px] text-ink/60">
                        {KIND_LABELS[eat.kind] ?? eat.kind}
                      </span>
                      {eat.priceTier && (
                        <span className="font-body text-[11px] font-semibold tabular-nums text-ink/45">
                          {eat.priceTier}
                        </span>
                      )}
                    </div>

                    <h4 className="mt-2.5 font-display text-lg leading-snug text-ink">{eat.name}</h4>
                    <p className="mt-1.5 font-body text-sm text-ink/70">
                      <span className="font-semibold text-ink/80">Get: </span>
                      {eat.whatToOrder}
                    </p>
                    <p className="mt-1.5 font-body text-sm text-ink/55">{eat.why}</p>

                    {/* Closed days and seasons are prominent (red) — a stated caveat
                        is the difference between a good tip and a wasted drive.
                        Routine hours are neutral, so red keeps meaning "watch out". */}
                    {eat.hoursNote && (
                      <p
                        className={`mt-3 rounded-card px-3 py-2 font-body text-xs ${
                          hoursNoteTone(eat.hoursNote) === "caution"
                            ? "bg-stampRed/[0.06] font-medium text-stampRed"
                            : "bg-paperDark text-ink/65"
                        }`}
                      >
                        {eat.hoursNote}
                      </p>
                    )}

                    <div className="mt-auto pt-4">
                      <p className="font-body text-[11px] text-ink/40">
                        {eat.openEvidence}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                        <a
                          href={eat.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-body text-[11px] font-semibold text-ink/45 hover:text-coralDark hover:underline"
                        >
                          {eat.sourceName} <ExternalLink size={10} />
                        </a>
                        <AddToTripButton
                          isSignedIn={isSignedIn}
                          trips={trips}
                          place={{
                            name: `${eat.name} (${group.town})`,
                            note: `${eat.whatToOrder}${eat.hoursNote ? ` — ${eat.hoursNote}` : ""}`,
                            sourceKind: "road_eat",
                            sourceSlug: sourceSlugForSave,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
