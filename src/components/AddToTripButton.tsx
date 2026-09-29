"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BookmarkPlus, Check, ChevronDown } from "lucide-react";
import { savePlaceToTrip, type SavePlaceInput } from "@/lib/actions";

export type TripOption = { id: string; title: string };

/**
 * "Add to trip" on a place in a guide — the thing that was missing.
 *
 * Three states, because this sits on a public page:
 *   • signed out        → a link to sign in, not a dead button
 *   • signed in, no trips → a link to start one
 *   • signed in with trips → pick which
 *
 * With exactly one trip it saves in a single click and skips the picker
 * entirely, which is the common case and the whole point of the feature.
 */
export default function AddToTripButton({
  place,
  trips,
  isSignedIn,
}: {
  place: SavePlaceInput;
  trips: TripOption[];
  isSignedIn: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  function save(tripId: string, tripTitle: string) {
    startTransition(async () => {
      await savePlaceToTrip(tripId, place);
      setSavedTo(tripTitle);
      setPicking(false);
    });
  }

  if (!isSignedIn) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1 font-body text-xs text-ink/40 transition-colors hover:text-coralDark"
      >
        <BookmarkPlus size={12} /> Sign in to add this to a trip
      </Link>
    );
  }

  if (trips.length === 0) {
    return (
      <Link
        href="/"
        className="inline-flex items-center gap-1 font-body text-xs text-ink/40 transition-colors hover:text-coralDark"
      >
        <BookmarkPlus size={12} /> Start a trip to save this to
      </Link>
    );
  }

  if (savedTo) {
    return (
      <span className="inline-flex items-center gap-1 font-body text-xs font-semibold text-forest">
        <Check size={12} /> Saved to {savedTo}
      </span>
    );
  }

  if (trips.length === 1) {
    return (
      <button
        onClick={() => save(trips[0].id, trips[0].title)}
        disabled={isPending}
        className="inline-flex items-center gap-1 font-body text-xs font-semibold text-coralDark transition-opacity hover:underline disabled:opacity-50"
      >
        <BookmarkPlus size={12} /> {isPending ? "Saving…" : `Add to ${trips[0].title}`}
      </button>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setPicking((v) => !v)}
        disabled={isPending}
        aria-expanded={picking}
        className="inline-flex items-center gap-1 font-body text-xs font-semibold text-coralDark transition-opacity hover:underline disabled:opacity-50"
      >
        <BookmarkPlus size={12} /> Add to a trip <ChevronDown size={11} />
      </button>

      {picking && (
        <div className="absolute left-0 z-10 mt-1.5 min-w-[13rem] overflow-hidden rounded-card bg-paper py-1 shadow-paper-lg">
          {trips.map((t) => (
            <button
              key={t.id}
              onClick={() => save(t.id, t.title)}
              disabled={isPending}
              className="block w-full px-3.5 py-2 text-left font-body text-sm text-ink/80 transition-colors hover:bg-paperDark disabled:opacity-50"
            >
              {t.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
