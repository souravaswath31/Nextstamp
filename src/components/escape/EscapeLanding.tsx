"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen, Users } from "lucide-react";
import { createRoom, saveToken } from "./client";

// The front door for Escape Hatch. Two ways in: start a room, or type a code a friend read out.
export default function EscapeLanding({ states }: { states: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [from, setFrom] = useState("illinois");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { code: c, token } = await createRoom(name, from);
      saveToken(c, token);
      router.push(`/escape/${c}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a game.");
      setBusy(false);
    }
  }

  function join(e: FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (c.length < 4) {
      setError("Codes are five letters. Check the one on your friend's screen.");
      return;
    }
    router.push(`/escape/${c}`);
  }

  return (
    <div className="space-y-10 pb-10">
      <section className="-mx-5 rounded-hero bg-paper px-6 py-12 shadow-paper sm:-mx-8 sm:px-12 sm:py-16">
        <p className="font-stamp text-xs uppercase tracking-widest text-coral">The weekend trip game</p>
        <h1 className="mt-3 font-display text-5xl tracking-tightest text-ink sm:text-7xl">
          Escape
          <br />
          Hatch<span className="text-coral">.</span>
        </h1>
        <p className="mt-5 max-w-xl font-body text-lg text-ink/75">
          Someone at the table says &ldquo;we should just go somewhere&rdquo;. Now you actually will. Four questions,
          one veto each, and a real weekend itinerary before anyone can back out.
        </p>
        <ul className="mt-6 flex flex-wrap gap-2 font-stamp text-xs uppercase tracking-wider text-ink/70">
          {["2 to 8 friends", "Each on their own phone", "About 4 minutes", "All 50 states", "Free"].map((t) => (
            <li key={t} className="rounded-full border border-line px-3 py-1.5">
              {t}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <form onSubmit={start} className="space-y-4 rounded-panel bg-paper p-6 shadow-paper">
          <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
            <DoorOpen size={22} className="text-coral" /> Start a game
          </h2>
          <p className="font-body text-sm text-ink/60">You will be the host. Everyone joins with a five-letter code.</p>
          <label className="block">
            <span className="font-stamp text-xs uppercase tracking-widest text-ink/50">Your first name</span>
            <input
              id="host-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={14}
              autoComplete="given-name"
              className="mt-1.5 w-full rounded-card border border-line bg-paperDark px-4 py-3 font-body text-ink outline-none focus:border-coral"
              placeholder="Alex"
            />
          </label>
          <label className="block">
            <span className="font-stamp text-xs uppercase tracking-widest text-ink/50">Where are you starting from?</span>
            <select
              id="host-from"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1.5 w-full rounded-card border border-line bg-paperDark px-4 py-3 font-body text-ink outline-none focus:border-coral"
            >
              {states.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy || !name.trim()} className="btn-pill btn-pill-primary w-full justify-center disabled:opacity-50">
            {busy ? "Opening the hatch..." : "Open a room"}
          </button>
        </form>

        <form onSubmit={join} className="space-y-4 rounded-panel bg-paper p-6 shadow-paper">
          <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
            <Users size={22} className="text-coral" /> Join a game
          </h2>
          <p className="font-body text-sm text-ink/60">Type the code from the host&rsquo;s screen, or open the invite link they sent.</p>
          <label className="block">
            <span className="font-stamp text-xs uppercase tracking-widest text-ink/50">Room code</span>
            <input
              id="room-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              className="mt-1.5 w-full rounded-card border border-line bg-paperDark px-4 py-3 text-center font-stamp text-3xl uppercase tracking-[0.4em] text-ink outline-none focus:border-coral"
              placeholder="ABCDE"
            />
          </label>
          <button type="submit" className="btn-pill btn-pill-accent w-full justify-center">
            Find the room
          </button>
        </form>
      </div>

      {error && (
        <p role="alert" className="rounded-card border border-stampRed/40 bg-stampRed/10 px-4 py-3 font-body text-sm text-ink">
          {error}
        </p>
      )}

      <section className="rounded-panel border border-line px-6 py-6">
        <h2 className="font-display text-xl text-ink">How it works</h2>
        <ol className="mt-3 grid gap-3 font-body text-sm text-ink/70 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Huddle", "Everyone joins the room on their own phone."],
            ["Four questions", "Budget, days, month, how far, plus six this-or-that duels, answered in secret."],
            ["The draw", "Three real weekend trips are dealt from the NextStamp library."],
            ["Pick and veto", "One pick and one veto each. The most picks wins."],
            ["The pact", "Everyone holds to commit. You get a boarding pass for the group chat."],
          ].map(([t, d]) => (
            <li key={t}>
              <p className="font-stamp text-xs uppercase tracking-widest text-coral">{t}</p>
              <p className="mt-1">{d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 font-body text-xs text-ink/50">
          Trips, days and stops are real NextStamp itineraries cut down to your days. Costs are rough and leave out getting there.
          Distance is a straight line, not a drive time. Nothing is booked.
        </p>
      </section>
    </div>
  );
}
