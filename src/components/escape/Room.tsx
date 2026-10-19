"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Check, Copy, Crown, Link2, Plane, RefreshCw, Share2, Swords, Ban, Heart } from "lucide-react";
import type { Action, GameView } from "@/lib/escape/game";
import { DUELS, MONTHS, REACH_LABEL, type Card, type GameConfig, type Reach } from "@/lib/escape/engine";
import { STATE_CENTROIDS } from "@/lib/escape/stateCentroids";
import { ApiError, fetchView, forgetToken, joinRoom, readToken, saveToken, sendAction } from "./client";

const LETTERS = ["A", "B", "C"];
const CAT_COLOR: Record<string, string> = {
  nature: "#2f6b57", city: "#3b4f86", water: "#1f6f8b", "off-the-beaten-path": "#7a4a2b",
  "road-trip": "#8a3f4e", splurge: "#6b4a8a", budget: "#4d6b2f",
};

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const copy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setFallback(null);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    } catch {
      setFallback(text); // clipboard blocked: show the text so it can be selected by hand
    }
  }, []);
  return { copied, copy, fallback };
}

export default function Room({ code }: { code: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<GameView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lost, setLost] = useState<string | null>(null);
  const version = useRef<string | null>(null);

  useEffect(() => {
    setToken(readToken(code));
    setReady(true);
  }, [code]);

  const poll = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetchView(code, token, version.current);
      if ("unchanged" in r) return;
      version.current = r.version;
      setView(r);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
        forgetToken(code);
        setLost(e.message);
      }
    }
  }, [code, token]);

  useEffect(() => {
    if (!token || lost) return;
    poll();
    const id = setInterval(() => {
      if (!document.hidden) poll();
    }, 2000);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token, lost, poll]);

  // A new round starts at the top of the screen, not wherever the last one was scrolled to.
  const phase = view?.phase;
  const lastPhase = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (phase && lastPhase.current && lastPhase.current !== phase) window.scrollTo({ top: 0 });
    lastPhase.current = phase;
  }, [phase]);

  const run = useCallback(
    async (action: Action) => {
      if (!token) return;
      setError(null);
      try {
        await sendAction(code, token, action);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
      version.current = null;
      await poll();
    },
    [code, token, poll]
  );

  if (!ready) return <Panel>Opening the room...</Panel>;
  if (lost)
    return (
      <Panel>
        <h1 className="font-display text-3xl text-ink">{lost}</h1>
        <p className="mt-3 font-body text-ink/65">The room may have been closed, or the code is wrong.</p>
        <Link href="/escape" className="btn-pill btn-pill-primary mt-6 inline-flex">
          Start or join a game
        </Link>
      </Panel>
    );
  if (!token) return <JoinForm code={code} onJoined={(t) => { saveToken(code, t); setToken(t); }} />;
  if (!view) return <Panel>Finding your friends...</Panel>;

  return (
    <div className="space-y-6 pb-12">
      <TopBar view={view} />
      <PlayerStrip view={view} />
      {error && (
        <p role="alert" className="rounded-card border border-stampRed/40 bg-stampRed/10 px-4 py-3 font-body text-sm text-ink">
          {error}
        </p>
      )}
      {view.phase === "lobby" && <Lobby view={view} run={run} />}
      {view.phase === "duels" && <Duels view={view} run={run} />}
      {view.phase === "draw" && <Draw view={view} run={run} />}
      {view.phase === "vote" && <Vote view={view} run={run} />}
      {view.phase === "pact" && <Pact view={view} run={run} />}
      {view.phase === "done" && <Done view={view} run={run} />}
    </div>
  );
}

// ---- small pieces ----------------------------------------------------------------------------
function Panel({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-xl rounded-panel bg-paper p-8 text-center font-body text-ink/70 shadow-paper">{children}</div>;
}

function Stamp({ children }: { children: ReactNode }) {
  return <p className="font-stamp text-xs uppercase tracking-widest text-coral">{children}</p>;
}

function Step({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div>
      <Stamp>{n}</Stamp>
      <h2 className="mt-1 font-display text-3xl tracking-tightest text-ink sm:text-4xl">{title}</h2>
      {sub && <p className="mt-2 max-w-xl font-body text-ink/65">{sub}</p>}
    </div>
  );
}

function Waiting({ names, verb }: { names: string[]; verb: string }) {
  if (names.length === 0) return null;
  return (
    <p className="font-body text-sm text-ink/60">
      <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-coral align-middle" />
      Waiting for {names.join(", ")} to {verb}.
    </p>
  );
}

function TopBar({ view }: { view: GameView }) {
  const { copied, copy } = useCopy();
  const link = typeof window !== "undefined" ? `${window.location.origin}/escape/${view.code}` : "";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/escape" className="font-display text-xl text-ink">
        Escape Hatch<span className="text-coral">.</span>
      </Link>
      <button
        type="button"
        onClick={() => copy("invite", link)}
        className="flex items-center gap-2 rounded-full border border-line px-4 py-2 font-stamp text-sm tracking-[0.3em] text-ink hover:border-coral"
        aria-label={`Room code ${view.code.split("").join(" ")}. Copy invite link`}
      >
        {view.code}
        {copied === "invite" ? <Check size={14} className="text-forest" /> : <Link2 size={14} className="text-ink/50" />}
      </button>
    </div>
  );
}

const AVATAR = ["#FF5A5F", "#F5A623", "#06B6D4", "#2FA84F", "#8B7BFF", "#FB7A3C", "#E63946", "#3b82f6"];
function PlayerStrip({ view }: { view: GameView }) {
  const badge = (p: GameView["players"][number]): string | null => {
    if (view.phase === "duels") return p.duelsDone ? "Ready" : "Thinking";
    if (view.phase === "vote") return p.voted ? "Voted" : "Deciding";
    if (view.phase === "pact") return p.committed ? "In" : "Not yet";
    return null;
  };
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Players">
      {view.players.map((p, i) => {
        const b = badge(p);
        const good = b === "Ready" || b === "Voted" || b === "In";
        return (
          <li key={p.id} className="flex items-center gap-2 rounded-full bg-paper py-1.5 pl-1.5 pr-3 shadow-paper">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full font-display text-sm text-white"
              style={{ background: AVATAR[i % AVATAR.length] }}
              aria-hidden="true"
            >
              {p.name[0]?.toUpperCase()}
            </span>
            <span className="font-body text-sm text-ink">
              {p.name}
              {p.id === view.you.id ? " (you)" : ""}
            </span>
            {p.isHost && <Crown size={13} className="text-stamp" aria-label="Host" />}
            {b && <span className={`font-stamp text-[10px] uppercase tracking-wider ${good ? "text-forest" : "text-ink/45"}`}>{b}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function JoinForm({ code, onJoined }: { code: string; onJoined: (token: string) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await joinRoom(code, name);
      onJoined(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join.");
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 rounded-panel bg-paper p-8 shadow-paper">
      <Stamp>Room {code}</Stamp>
      <h1 className="font-display text-3xl tracking-tightest text-ink">You are invited to escape.</h1>
      <p className="font-body text-ink/65">Type your first name to join the table.</p>
      <input
        id="join-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={14}
        autoComplete="given-name"
        className="w-full rounded-card border border-line bg-paperDark px-4 py-3 font-body text-ink outline-none focus:border-coral"
        placeholder="Your first name"
      />
      {error && (
        <p role="alert" className="font-body text-sm text-stampRed">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || !name.trim()} className="btn-pill btn-pill-primary w-full justify-center disabled:opacity-50">
        {busy ? "Joining..." : "Join the game"}
      </button>
    </form>
  );
}

// ---- lobby -------------------------------------------------------------------------------------
function Seg<T extends string | number>({ value, options, onChange, disabled }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          disabled={disabled}
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-full px-4 py-2 font-body text-sm font-semibold transition ${
            value === o.v ? "bg-coral text-white" : "border border-line text-ink/70 hover:border-coral"
          } disabled:cursor-default`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Lobby({ view, run }: { view: GameView; run: (a: Action) => Promise<void> }) {
  const { copied, copy } = useCopy();
  const isHost = view.you.isHost;
  const c = view.config;
  const link = typeof window !== "undefined" ? `${window.location.origin}/escape/${view.code}` : "";
  const set = (patch: Partial<GameConfig>) => run({ type: "config", config: patch });
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <div className="space-y-6">
      <Step
        n="Round 1 · The Huddle"
        title={isHost ? "Get everyone in the room." : "You're in. Hang tight."}
        sub={isHost ? "Friends join with the code or the link. Start when everyone is here." : "The host sets the basics and starts the game. Meanwhile, tell the others to hurry."}
      />
      <div className="rounded-panel bg-paper p-6 text-center shadow-paper">
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/50">Room code</p>
        <p className="mt-2 font-stamp text-5xl tracking-[0.35em] text-ink sm:text-6xl">{view.code}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => copy("link", link)} className="btn-pill btn-pill-primary">
            {copied === "link" ? <Check size={16} /> : <Copy size={16} />} {copied === "link" ? "Link copied" : "Copy invite link"}
          </button>
          {canShare && (
            <button
              type="button"
              onClick={() => navigator.share({ title: "Escape Hatch", text: `Join my trip game. Code ${view.code}`, url: link }).catch(() => {})}
              className="btn-pill btn-pill-accent"
            >
              <Share2 size={16} /> Share
            </button>
          )}
        </div>
      </div>

      <div className="space-y-5 rounded-panel bg-paper p-6 shadow-paper">
        <h3 className="font-display text-xl text-ink">The basics</h3>
        <Field label="Starting from">
          <select
            id="cfg-from"
            disabled={!isHost}
            value={c.fromState}
            onChange={(e) => set({ fromState: e.target.value })}
            className="w-full rounded-card border border-line bg-paperDark px-4 py-3 font-body text-ink disabled:opacity-80"
          >
            {Object.entries(STATE_CENTROIDS)
              .sort((a, b) => a[1].name.localeCompare(b[1].name))
              .map(([slug, s]) => (
                <option key={slug} value={slug}>
                  {s.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Days off">
          <Seg value={c.days} disabled={!isHost} onChange={(v) => set({ days: v })} options={[2, 3, 4, 5].map((n) => ({ v: n, label: `${n} days` }))} />
        </Field>
        <Field label="When">
          <select
            id="cfg-month"
            disabled={!isHost}
            value={c.month}
            onChange={(e) => set({ month: Number(e.target.value) })}
            className="w-full rounded-card border border-line bg-paperDark px-4 py-3 font-body text-ink disabled:opacity-80"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="How far">
          <Seg
            value={c.reach}
            disabled={!isHost}
            onChange={(v: Reach) => set({ reach: v })}
            options={(["drive", "hop", "any"] as Reach[]).map((r) => ({ v: r, label: r === "drive" ? "A drive (~300 mi)" : REACH_LABEL[r] }))}
          />
        </Field>
        <p className="font-body text-xs text-ink/50">Budget is private: each friend sets their own in the next round, and the group takes the lowest.</p>
      </div>

      {isHost ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={view.players.length < 2}
            onClick={() => run({ type: "start" })}
            className="btn-pill btn-pill-primary w-full justify-center py-4 text-lg disabled:opacity-50"
          >
            Start the game ({view.players.length} in)
          </button>
          {view.players.length < 2 && <p className="text-center font-body text-sm text-ink/55">You need at least two players.</p>}
        </div>
      ) : (
        <p className="text-center font-body text-sm text-ink/55">Waiting for the host to start.</p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-stamp text-xs uppercase tracking-widest text-ink/50">{label}</p>
      {children}
    </div>
  );
}

// ---- duels -------------------------------------------------------------------------------------
function Duels({ view, run }: { view: GameView; run: (a: Action) => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [budget, setBudget] = useState(400);
  const [sending, setSending] = useState(false);
  const pending = view.players.filter((p) => !p.duelsDone).map((p) => p.name);
  const doneCount = view.players.length - pending.length;

  if (view.you.duelsDone) {
    return (
      <div className="space-y-5">
        <Step n="Round 2 · Locked in" title="Your answers are sealed." sub="Nobody sees them until the cards are dealt." />
        <Waiting names={pending} verb="finish" />
        {view.you.isHost && doneCount >= 2 && pending.length > 0 && (
          <button type="button" onClick={() => run({ type: "deal" })} className="btn-pill btn-pill-accent">
            Deal now without {pending.join(", ")}
          </button>
        )}
      </div>
    );
  }

  if (step < DUELS.length) {
    const d = DUELS[step];
    const choose = (c: number) => {
      setAnswers([...answers, c]);
      setStep(step + 1);
    };
    return (
      <div className="space-y-5">
        <Step n={`Round 2 · This or that (${step + 1} of ${DUELS.length})`} title="Which one?" sub="Go with your gut. Your friends cannot see your answers." />
        <div className="grid grid-cols-2 gap-4">
          {[d.a, d.b].map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => choose(i)}
              className="card-lift min-h-[10rem] rounded-panel bg-paper p-5 text-center font-display text-2xl tracking-tightest text-ink shadow-paper hover:ring-2 hover:ring-coral sm:min-h-[14rem] sm:text-3xl"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Step n="Round 2 · Last one" title="What can you spend?" sub="Per person for the weekend, not counting getting there. The group uses the lowest number, so nobody gets stuck with a bill they hate." />
      <div className="rounded-panel bg-paper p-6 shadow-paper">
        <p className="text-center font-stamp text-5xl text-ink">${budget}</p>
        <input
          id="budget-slider"
          type="range"
          min={100}
          max={1500}
          step={50}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="mt-5 w-full accent-coral"
          aria-label="Your budget per person in dollars"
        />
        <div className="mt-1 flex justify-between font-stamp text-xs text-ink/45">
          <span>$100</span>
          <span>$1,500</span>
        </div>
      </div>
      <button
        type="button"
        disabled={sending}
        onClick={async () => {
          setSending(true);
          await run({ type: "duels", answers, budget });
          setSending(false);
        }}
        className="btn-pill btn-pill-primary w-full justify-center py-4 text-lg"
      >
        {sending ? "Sealing..." : "Seal my answers"}
      </button>
    </div>
  );
}

// ---- cards ---------------------------------------------------------------------------------------
function TripCard({ card, index, animate, children }: { card: Card; index: number; animate?: boolean; children?: ReactNode }) {
  const color = CAT_COLOR[card.categories[0]] ?? "#26485e";
  return (
    <article
      className={`grid grid-cols-[4.5rem_1fr] overflow-hidden rounded-panel bg-[#ece8dd] text-[#18202a] shadow-paper sm:grid-cols-[6rem_1fr] ${animate ? "eh-flip" : ""}`}
      style={{ animationDelay: animate ? `${index * 0.35}s` : undefined }}
    >
      <div className="flex flex-col items-center justify-between border-r-2 border-dashed border-[#c9c3b3] p-3 text-center text-white" style={{ background: color }}>
        <span className="font-stamp text-[10px] tracking-[0.15em] opacity-80">CARD</span>
        <span className="font-display text-4xl leading-none">{LETTERS[index]}</span>
        <span className="font-stamp text-[10px]">{card.days.length} DAYS</span>
      </div>
      <div className="min-w-0 p-4 sm:p-5">
        <h3 className="font-display text-lg leading-tight sm:text-xl">{card.title}</h3>
        <p className="mt-1 font-stamp text-xs text-[#55606b]">{card.stateNames}</p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {card.why.map((w, i) => (
            <li
              key={i}
              className={`rounded-full border px-2.5 py-0.5 font-stamp text-[11px] ${
                w.tone === "good" ? "border-[#1c8f66] bg-[#e2f4ec] text-[#0d6a49]" : w.tone === "warn" ? "border-[#b4501a] bg-[#fbeadf] text-[#8a3d12]" : w.tone === "bad" ? "border-[#b3342a] bg-[#fbe4e1] text-[#8f261d]" : "border-[#b8b29f] text-[#2b3540]"
              }`}
            >
              {w.text}
            </li>
          ))}
        </ul>
        <ul className="mt-3 space-y-0.5 pl-4 text-sm text-[#36414d]" style={{ listStyle: "disc" }}>
          {card.days.map((d) => (
            <li key={d.n}>
              Day {d.n}: {d.title}
            </li>
          ))}
        </ul>
        {children}
      </div>
    </article>
  );
}

function Notes({ view }: { view: GameView }) {
  const m = view.meta;
  if (!m) return null;
  return (
    <div className="space-y-1 font-body text-sm text-ink/60">
      {m.widenedTo && <p>Few trips were that close, so the draw widened to {m.widenedTo === "hop" ? "a short flight" : "anywhere in the US"}.</p>}
      {m.stretched && <p>Few trips fit that budget, so the draw went past it. Each card shows its real cost.</p>}
      {m.lockedCount > 0 && (
        <p>
          {m.lockedCount} more trips are in reach at about ${m.lockedFrom} each. A bigger budget unlocks them.
        </p>
      )}
    </div>
  );
}

// ---- the draw -------------------------------------------------------------------------------------
function Draw({ view, run }: { view: GameView; run: (a: Action) => Promise<void> }) {
  const [animate, setAnimate] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setAnimate(false), 2500);
    return () => clearTimeout(t);
  }, []);
  const cards = view.cards ?? [];
  return (
    <div className="space-y-6">
      <Step
        n="Round 3 · The Draw"
        title={cards.length ? "Your three cards." : "Nothing fits."}
        sub={`${view.vibeTop.length ? `Group vibe: ${view.vibeTop.join(" · ")}. ` : ""}$${view.groupBudget} each${view.budgetBoss ? ` (${view.budgetBoss} is the Budget Boss)` : ""}, ${view.config.days} days, ${MONTHS[view.config.month]}, from ${view.fromName}.`}
      />
      <ul className="flex flex-wrap gap-2">
        {view.players.filter((p) => p.role).map((p) => (
          <li key={p.id} className="rounded-full border border-line px-3 py-1 font-body text-xs text-ink/70">
            <span className="font-semibold text-ink">{p.name}</span> · {p.role}
          </li>
        ))}
      </ul>
      <div className="space-y-4">
        {cards.map((c, i) => (
          <TripCard key={c.itineraryId + i} card={c} index={i} animate={animate} />
        ))}
      </div>
      <Notes view={view} />
      {view.you.isHost ? (
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={cards.length < 2} onClick={() => run({ type: "open_vote" })} className="btn-pill btn-pill-primary disabled:opacity-50">
            <Swords size={16} /> Open the voting
          </button>
          <button type="button" disabled={view.redrawsLeft === 0} onClick={() => run({ type: "redraw" })} className="btn-pill btn-pill-accent disabled:opacity-50">
            <RefreshCw size={16} /> Redraw ({view.redrawsLeft} left)
          </button>
          <button type="button" onClick={() => run({ type: "again" })} className="btn-ghost">
            Change the basics
          </button>
        </div>
      ) : (
        <p className="font-body text-sm text-ink/55">Take a look. The host opens the voting when everyone has read the cards.</p>
      )}
    </div>
  );
}

// ---- the vote ---------------------------------------------------------------------------------------
function Vote({ view, run }: { view: GameView; run: (a: Action) => Promise<void> }) {
  const [pick, setPick] = useState<number | null>(view.you.pick);
  const [veto, setVeto] = useState<number | null>(view.you.veto);
  const [sending, setSending] = useState(false);
  const cards = view.cards ?? [];
  const waiting = view.players.filter((p) => !p.voted).map((p) => p.name);
  const togglePick = (i: number) => {
    setPick(pick === i ? null : i);
    if (veto === i) setVeto(null);
  };
  const toggleVeto = (i: number) => {
    setVeto(veto === i ? null : i);
    if (pick === i) setPick(null);
  };
  return (
    <div className="space-y-6">
      <Step n="Round 4 · Pick and veto" title="One pick. One veto." sub="Your vote is secret until everyone has voted. A vetoed card is out for the whole table." />
      <div className="space-y-4">
        {cards.map((c, i) => (
          <TripCard key={c.itineraryId + i} card={c} index={i}>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => togglePick(i)}
                aria-pressed={pick === i}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 font-body text-sm font-semibold ${
                  pick === i ? "border-[#1c8f66] bg-[#1c8f66] text-white" : "border-[#1c8f66] text-[#0d6a49]"
                }`}
              >
                <Heart size={15} /> {pick === i ? "Picked" : "Pick"}
              </button>
              <button
                type="button"
                onClick={() => toggleVeto(i)}
                aria-pressed={veto === i}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 font-body text-sm font-semibold ${
                  veto === i ? "border-[#b3342a] bg-[#b3342a] text-white" : "border-[#b3342a] text-[#8f261d]"
                }`}
              >
                <Ban size={15} /> {veto === i ? "Vetoed" : "Veto"}
              </button>
            </div>
          </TripCard>
        ))}
      </div>
      <button
        type="button"
        disabled={sending}
        onClick={async () => {
          setSending(true);
          await run({ type: "ballot", pick, veto });
          setSending(false);
        }}
        className="btn-pill btn-pill-primary w-full justify-center py-4 text-lg"
      >
        {view.you.voted ? "Update my vote" : "Lock in my vote"}
      </button>
      {view.you.voted && <p className="font-body text-sm text-forest">Your vote is in. You can still change it until the count.</p>}
      <Waiting names={waiting} verb="vote" />
      {view.you.isHost && view.players.some((p) => p.voted) && waiting.length > 0 && (
        <button type="button" onClick={() => run({ type: "count" })} className="btn-pill btn-pill-accent">
          Count the votes now
        </button>
      )}
    </div>
  );
}

// ---- the pact ---------------------------------------------------------------------------------------
function Pact({ view, run }: { view: GameView; run: (a: Action) => Promise<void> }) {
  const cards = view.cards ?? [];
  const count = view.count;
  const winner = count ? cards[count.winner] : null;
  const waiting = view.players.filter((p) => !p.committed).map((p) => p.name);
  // A tie goes to the spinner first; the pact screen opens once the spin has landed (or was skipped).
  const [spun, setSpun] = useState(false);
  if (!count || !winner) return <Panel>Counting...</Panel>;
  if (count.tied && count.tied.length > 1 && !spun)
    return <TieSpin cards={cards} tied={count.tied} winner={count.winner} picks={count.picks} onDone={() => setSpun(true)} />;
  const label = (i: number | null) => (i == null ? "·" : LETTERS[i]);
  return (
    <div className="space-y-6">
      <Step n="Round 5 · The Pact" title={`Card ${LETTERS[count.winner]} wins.`} sub={count.note} />
      <TripCard card={winner} index={count.winner} />
      <div className="overflow-x-auto rounded-panel border border-line">
        <table className="w-full min-w-[18rem] text-left font-body text-sm text-ink">
          <thead className="font-stamp text-xs uppercase tracking-wider text-ink/50">
            <tr>
              <th className="px-4 py-2">Friend</th>
              <th className="px-4 py-2">Picked</th>
              <th className="px-4 py-2">Vetoed</th>
            </tr>
          </thead>
          <tbody>
            {count.ballots.map((b) => (
              <tr key={b.name} className="border-t border-line">
                <td className="px-4 py-2">{b.name}</td>
                <td className="px-4 py-2 font-stamp">{label(b.pick)}</td>
                <td className="px-4 py-2 font-stamp">{label(b.veto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3">
        <p className="font-body text-ink/70">Everyone press and hold to commit. No take-backs.</p>
        <HoldButton done={view.you.committed} name={view.you.name} onCommit={() => run({ type: "commit" })} />
        <Waiting names={waiting} verb="commit" />
        {view.you.isHost && view.players.some((p) => p.committed) && waiting.length > 0 && (
          <button type="button" onClick={() => run({ type: "finish" })} className="btn-pill btn-pill-accent">
            Go with whoever is in
          </button>
        )}
      </div>
    </div>
  );
}

// Equal votes: the tied cards take turns lighting up, slow down, and stop on the winner. The winner is already
// fixed on the server (a seeded draw), so every phone lands on the same card; this is only the show.
function TieSpin({ cards, tied, winner, picks, onDone }: { cards: Card[]; tied: number[]; winner: number; picks: number[]; onDone: () => void }) {
  const [phase, setPhase] = useState<"ready" | "spinning" | "landed">("ready");
  const [lit, setLit] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const spin = () => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setLit(winner);
      setPhase("landed");
      return;
    }
    setPhase("spinning");
    // Walk the tied cards in order, a little slower each step, and stop on the winner after at least 14 steps.
    let step = 0;
    const tick = () => {
      const at = tied[step % tied.length];
      setLit(at);
      if (step >= 14 && at === winner) {
        setPhase("landed");
        return;
      }
      step++;
      timer.current = setTimeout(tick, 90 + step * 22);
    };
    tick();
  };

  const names = `Cards ${tied.map((i) => LETTERS[i]).join(" and ")}`;
  return (
    <div className="space-y-6">
      <Step
        n="Round 5 · Tiebreaker"
        title={phase === "landed" ? `Card ${LETTERS[winner]} it is.` : "It's a tie."}
        sub={phase === "landed" ? "The spin has spoken. No take-backs." : `${names} each got ${picks[tied[0]]} ${picks[tied[0]] === 1 ? "pick" : "picks"}. Spin the cards and let luck choose.`}
      />
      <ul className="grid gap-3 sm:grid-cols-2" aria-live="polite">
        {tied.map((i) => {
          const on = lit === i;
          const won = phase === "landed" && i === winner;
          return (
            <li
              key={i}
              className={`rounded-panel border-2 p-5 transition-all duration-150 ${
                won ? "scale-[1.03] border-coral bg-coral/15" : on ? "scale-[1.03] border-coral bg-paper" : "border-line bg-paper opacity-70"
              }`}
            >
              <p className="font-stamp text-xs uppercase tracking-widest text-coral">Card {LETTERS[i]}</p>
              <p className="mt-1 font-display text-xl leading-tight text-ink">{cards[i]?.title}</p>
              <p className="mt-1 font-body text-sm text-ink/60">{cards[i]?.stateNames}</p>
            </li>
          );
        })}
      </ul>
      {phase === "ready" && (
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={spin} className="btn-pill btn-pill-primary px-8 py-4 text-lg">
            <RefreshCw size={18} /> Spin the cards
          </button>
          <button type="button" onClick={onDone} className="btn-ghost">
            Skip the spin
          </button>
        </div>
      )}
      {phase === "spinning" && <p className="font-body text-ink/60">Spinning...</p>}
      {phase === "landed" && (
        <button type="button" onClick={onDone} className="btn-pill btn-pill-primary px-8 py-4 text-lg">
          Lock it in
        </button>
      )}
    </div>
  );
}

function HoldButton({ done, name, onCommit }: { done: boolean; name: string; onCommit: () => void }) {
  const [progress, setProgress] = useState(0);
  const raf = useRef(0);
  const start = useRef(0);
  const fired = useRef(false);
  const stop = () => {
    cancelAnimationFrame(raf.current);
    start.current = 0;
    if (!fired.current) setProgress(0);
  };
  const tick = (ts: number) => {
    if (!start.current) start.current = ts;
    const p = Math.min(1, (ts - start.current) / 700);
    setProgress(p);
    if (p >= 1) {
      fired.current = true;
      onCommit();
    } else raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-card border border-forest bg-forest/10 px-5 py-4 font-body font-semibold text-forest">
        <Check size={18} /> {name}, you are in.
      </div>
    );
  }
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        raf.current = requestAnimationFrame(tick);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!fired.current) {
            fired.current = true;
            onCommit();
          }
        }
      }}
      className="relative w-full select-none overflow-hidden rounded-card border border-line bg-paper px-5 py-5 text-left font-display text-xl text-ink shadow-paper"
      style={{ touchAction: "none" }}
    >
      <span className="absolute inset-y-0 left-0 bg-coral/40" style={{ width: `${progress * 100}%` }} aria-hidden="true" />
      <span className="relative">Hold to commit</span>
    </button>
  );
}

// ---- the boarding pass ------------------------------------------------------------------------------
function Done({ view, run }: { view: GameView; run: (a: Action) => Promise<void> }) {
  const { copied, copy, fallback } = useCopy();
  const [wish, setWish] = useState("");
  const [shared, setShared] = useState(view.pass?.shared ?? false);
  const pass = view.pass;
  if (!pass) return <Panel>Printing your boarding pass...</Panel>;
  const card = pass.card;
  const color = CAT_COLOR[card.categories[0]] ?? "#26485e";
  const toName = STATE_CENTROIDS[card.states[0]]?.name ?? "";
  return (
    <div className="space-y-6">
      <Step n="Boarding pass" title="You're going." sub="Screenshot it. Post it. It is hard to un-say in the group chat." />
      <article className="overflow-hidden rounded-panel bg-[#ece8dd] text-[#18202a] shadow-paper">
        <div className="flex flex-wrap justify-between gap-2 px-5 py-3 font-stamp text-xs uppercase tracking-[0.12em] text-white" style={{ background: color }}>
          <span>Escape Hatch · Boarding pass</span>
          <span>{pass.crew.join(" / ")}</span>
        </div>
        <div className="p-5 sm:p-6">
          <h3 className="font-display text-2xl leading-tight">{card.title}</h3>
          <dl className="my-4 grid grid-cols-2 gap-3 border-y-2 border-dashed border-[#c9c3b3] py-4 sm:grid-cols-4">
            {[
              ["Days", String(card.days.length)],
              ["Each, about", `$${card.cost}`],
              ["When", MONTHS[view.config.month]],
              [`From ${view.fromName}`, card.distance == null ? "Not measured" : card.distance < 30 ? "Right there" : `About ${card.distance} mi`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="font-stamp text-[10px] uppercase tracking-[0.12em] text-[#5a6571]">{k}</dt>
                <dd className="mt-0.5 font-body text-base font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-4">
            {card.days.map((d) => (
              <div key={d.n}>
                <p className="font-stamp text-xs uppercase tracking-[0.08em] text-[#5a6571]">Day {d.n}</p>
                <p className="font-body font-semibold">{d.title}</p>
                {d.activities.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-4 text-sm text-[#36414d]" style={{ listStyle: "disc" }}>
                    {d.activities.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                )}
                {d.lodging && <p className="mt-1 text-sm text-[#5a6571]">Stay in {d.lodging}</p>}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-[#5a6571]">
            {card.totalDays > card.days.length ? `Days ${card.windowStart + 1} to ${card.windowStart + card.days.length} of a ${card.totalDays}-day itinerary. ` : ""}
            Cost excludes getting there, and distance is a straight line. Nothing is booked.
          </p>
        </div>
      </article>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => copy("pass", pass.text)} className="btn-pill btn-pill-primary">
          {copied === "pass" ? <Check size={16} /> : <Copy size={16} />} {copied === "pass" ? "Copied" : "Copy for the group chat"}
        </button>
        <Link href={`/itineraries/${card.slug}`} className="btn-pill btn-pill-accent">
          See the full itinerary
        </Link>
        <Link href={`/flights?from=${encodeURIComponent(view.fromName)}&to=${encodeURIComponent(toName)}`} className="btn-ghost">
          <Plane size={15} /> Plan getting there
        </Link>
      </div>
      {fallback && (
        <textarea readOnly aria-label="Trip summary to copy" value={fallback} onFocus={(e) => e.currentTarget.select()} className="h-40 w-full rounded-card border border-line bg-paperDark p-3 font-stamp text-xs text-ink" />
      )}

      {view.you.isHost && (
        <div className="space-y-4 rounded-panel border border-line p-5">
          <h3 className="font-display text-lg text-ink">After the game</h3>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => run({ type: "again" })} className="btn-pill btn-pill-accent">
              <RefreshCw size={16} /> Rematch with the same crew
            </button>
          </div>
          {!shared ? (
            <div className="space-y-2">
              <p className="font-body text-sm text-ink/65">
                Help us pick the next trips. Send an anonymous summary of this game: the settings, the cards, what won and what got vetoed. No names.
              </p>
              <input
                id="wish"
                value={wish}
                onChange={(e) => setWish(e.target.value)}
                maxLength={140}
                placeholder="Optional: where did you actually want to go?"
                className="w-full rounded-card border border-line bg-paperDark px-4 py-3 font-body text-sm text-ink outline-none focus:border-coral"
              />
              <button
                type="button"
                onClick={async () => {
                  await run({ type: "share", wish });
                  setShared(true);
                }}
                className="btn-ghost"
              >
                Send the anonymous summary
              </button>
            </div>
          ) : (
            <p className="font-body text-sm text-forest">Thanks. That helps us decide what to build next.</p>
          )}
        </div>
      )}
    </div>
  );
}
