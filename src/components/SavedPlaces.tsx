"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bookmark, Trash2, CalendarPlus, Check, MapPin } from "lucide-react";
import { addSavedPlaceToDay, removeSavedPlace } from "@/lib/actions";

export type SavedPlace = {
  id: string;
  name: string;
  note: string | null;
  sourceKind: string | null;
  sourceSlug: string | null;
  usedOnDay: number | null;
  hasCoords: boolean;
};

/**
 * The receiving end of "add to trip".
 *
 * Places arrive here from the guides without a day attached, because at
 * browsing time you rarely know which day yet. Slotting one into a day appends
 * it to that day's activities and marks it used — it stays visible rather than
 * disappearing, so you can see what you've already placed. Making it vanish
 * reads like the app lost it.
 */
export default function SavedPlaces({
  tripId,
  places,
  dayNumbers,
}: {
  tripId: string;
  places: SavedPlace[];
  dayNumbers: number[];
}) {
  const [isPending, startTransition] = useTransition();
  const [openFor, setOpenFor] = useState<string | null>(null);

  if (places.length === 0) return null;

  const unplaced = places.filter((p) => p.usedOnDay === null);
  const placed = places.filter((p) => p.usedOnDay !== null);

  function slot(placeId: string, day: number) {
    startTransition(async () => {
      await addSavedPlaceToDay(tripId, placeId, day);
      setOpenFor(null);
    });
  }

  function remove(placeId: string) {
    startTransition(async () => {
      await removeSavedPlace(tripId, placeId);
    });
  }

  return (
    <section className="rounded-panel bg-paper p-6 shadow-paper">
      <h2 className="flex items-center gap-2 font-display text-xl text-ink">
        <Bookmark size={19} className="text-ink/35" /> Places you&apos;ve saved
      </h2>
      <p className="mt-1 font-body text-sm text-ink/60">
        Pulled in from the guides. Drop them onto a day when you know where they fit.
      </p>

      <ul className="mt-5 space-y-2">
        {[...unplaced, ...placed].map((p) => (
          <li
            key={p.id}
            className={`group rounded-card px-4 py-3 transition-colors ${
              p.usedOnDay !== null ? "bg-forest/[0.06]" : "bg-paperDark"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-body text-sm font-semibold text-ink">
                  {p.name}
                  {p.hasCoords && <MapPin size={11} className="shrink-0 text-ink/30" />}
                </p>
                {p.note && <p className="mt-0.5 font-body text-xs text-ink/60">{p.note}</p>}
                {p.sourceKind === "state_place" && p.sourceSlug && (
                  <Link
                    href={`/state/${p.sourceSlug}`}
                    className="mt-1 inline-block font-body text-[11px] text-ink/40 hover:text-coralDark hover:underline"
                  >
                    from the {p.sourceSlug.replace(/-/g, " ")} guide
                  </Link>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {p.usedOnDay !== null ? (
                  <span className="flex items-center gap-1 font-body text-[11px] font-semibold text-forest">
                    <Check size={11} /> on day {p.usedOnDay}
                  </span>
                ) : dayNumbers.length > 0 ? (
                  <div className="relative">
                    <button
                      onClick={() => setOpenFor(openFor === p.id ? null : p.id)}
                      disabled={isPending}
                      aria-expanded={openFor === p.id}
                      className="flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 font-body text-[11px] font-semibold text-coralDark shadow-paper disabled:opacity-50"
                    >
                      <CalendarPlus size={11} /> Add to a day
                    </button>
                    {openFor === p.id && (
                      <div className="absolute right-0 z-10 mt-1.5 max-h-56 overflow-y-auto rounded-card bg-paper py-1 shadow-paper-lg">
                        {dayNumbers.map((d) => (
                          <button
                            key={d}
                            onClick={() => slot(p.id, d)}
                            disabled={isPending}
                            className="block w-full px-4 py-1.5 text-left font-body text-sm text-ink/80 transition-colors hover:bg-paperDark disabled:opacity-50"
                          >
                            Day {d}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="font-body text-[11px] text-ink/40">Add a day first</span>
                )}

                <button
                  onClick={() => remove(p.id)}
                  disabled={isPending}
                  className="text-ink/20 opacity-0 transition-opacity hover:text-stampRed group-hover:opacity-100 disabled:opacity-50"
                  aria-label={`Remove ${p.name}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
