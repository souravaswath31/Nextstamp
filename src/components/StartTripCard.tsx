"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Compass, Sparkles } from "lucide-react";
import { createBlankTrip } from "@/lib/actions";

/**
 * The dashboard's primary action.
 *
 * The dashboard used to ask "Where to next?" and then give the reader nowhere
 * to answer it — the only way to start a trip was a text link to /my-trips,
 * five tabs into the nav, where a form input was waiting. A brand-new user's
 * first screen was a question, a photo, three zeros, and the sentence
 * "Nothing in planning yet."
 *
 * NN/g's guidance on empty states is that they have to do three things at
 * once: say what belongs here, teach what the thing is for, and offer a direct
 * pathway to the task. This is the pathway. It creates the trip in place
 * rather than navigating somewhere to find a form.
 *
 * Two entry points, deliberately ranked rather than presented as equals: a
 * named trip for someone who knows where they're going, and browsing for
 * someone who doesn't. Offering both as peers is what makes people bounce.
 */
export default function StartTripCard({
  /** Changes the framing for someone with no trips yet vs. a returning planner. */
  isFirstTrip,
  /** How many places their documents already unlock — the hook, when we know it. */
  easyAccessCount,
}: {
  isFirstTrip: boolean;
  easyAccessCount: number;
}) {
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    // createBlankTrip redirects to the new trip, so there's no success state
    // to handle here — the page goes away.
    startTransition(async () => {
      await createBlankTrip(formData);
    });
  }

  return (
    <section className="rounded-hero bg-paper p-6 shadow-paper-lg sm:p-8">
      <h2 className="font-display text-2xl tracking-tightest text-ink sm:text-3xl">
        {isFirstTrip ? "Start your first trip" : "Start another trip"}
      </h2>
      <p className="mt-1.5 max-w-xl font-body text-sm text-ink/60">
        {isFirstTrip
          ? "Give it a name — anywhere you're curious about. You can change everything later, and nothing is booked or shared until you say so."
          : "Name it and we'll set up the dates, entry checks and packing list around it."}
      </p>

      <form action={submit} className="mt-5 flex flex-wrap gap-2">
        <input
          id="dashboard-new-trip"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Two weeks in Japan"
          aria-label="Name your trip"
          className="min-w-0 flex-1 rounded-full bg-paperDark px-5 py-3 font-body text-base text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
        />
        <button
          type="submit"
          disabled={isPending || !title.trim()}
          className="btn-pill btn-pill-accent !px-6 !py-3 disabled:opacity-40"
        >
          <Plus size={16} /> {isPending ? "Creating…" : "Start planning"}
        </button>
      </form>

      {/* The secondary path, visibly subordinate to the one above. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link href="/explore" className="btn-ghost !text-sm">
          <Compass size={14} /> Not sure yet — browse trip ideas
        </Link>
        {easyAccessCount > 0 && (
          <Link href="/profile" className="btn-ghost !text-sm">
            <Sparkles size={14} /> See the {easyAccessCount} places your passport already opens
          </Link>
        )}
      </div>
    </section>
  );
}
