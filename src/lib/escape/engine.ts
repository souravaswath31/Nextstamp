// Escape Hatch engine: everything the game decides, as pure functions with no database and no
// network, so it can be tested and so a draw is reproducible from its seed.
//
// What it must never do is invent a fact. Distances are straight lines from the middle of a state,
// costs come from the app's rough per-day estimate, and a trip is always a window of consecutive days
// cut from a real itinerary, labelled as such.
import { estimateTripCost, type CostTier } from "@/lib/costs";
import { STATE_CENTROIDS } from "./stateCentroids";

export type Reach = "drive" | "hop" | "any";
export const REACH_MILES: Record<Reach, number> = { drive: 300, hop: 1200, any: Number.POSITIVE_INFINITY };
export const REACH_LABEL: Record<Reach, string> = { drive: "A drive", hop: "A short flight", any: "Anywhere in the US" };

export type GameConfig = {
  fromState: string; // StateGuide slug
  days: number; // 2..5
  month: number; // 0..11
  reach: Reach;
};

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export type EngineDay = {
  title: string;
  activities: string[];
  lat: number | null;
  lon: number | null;
  eatTown: string | null;
  lodging: string | null;
};

export type EngineItinerary = {
  id: string;
  slug: string;
  title: string;
  tier: CostTier;
  categories: string[];
  months: number[]; // best months, 0..11
  states: string[]; // StateGuide slugs
  days: EngineDay[];
  cover: string | null;
};

/** A dealt card. A snapshot, so an ongoing game never changes under the players. */
export type Card = {
  itineraryId: string;
  slug: string;
  title: string;
  categories: string[];
  states: string[];
  stateNames: string;
  windowStart: number; // index into the itinerary's days
  totalDays: number; // days in the full itinerary
  cost: number; // per person, excluding getting there
  tier: CostTier;
  distance: number | null; // straight-line miles from the starting state
  overBudget: boolean;
  inSeason: boolean | null;
  days: { n: number; title: string; activities: string[]; eatTown: string | null; lodging: string | null }[];
  cover: string | null;
  why: { tone: "good" | "warn" | "bad" | "plain"; text: string }[];
};

export type DeckMeta = {
  widenedTo: Reach | null;
  stretched: boolean;
  lockedCount: number;
  lockedFrom: number;
};

// ---- randomness ----------------------------------------------------------------------------
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- geography -----------------------------------------------------------------------------
export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Start index of the run of `n` consecutive days whose mapped stops sit closest together; null if too short. */
export function bestWindow(days: EngineDay[], n: number): number | null {
  if (days.length < n) return null;
  let best = 0;
  let bestLen = Number.POSITIVE_INFINITY;
  for (let s = 0; s + n <= days.length; s++) {
    let len = 0;
    let prev: EngineDay | null = null;
    for (let k = s; k < s + n; k++) {
      const d = days[k];
      if (d.lat != null && d.lon != null) {
        if (prev && prev.lat != null && prev.lon != null) len += haversineMiles(prev.lat, prev.lon, d.lat, d.lon);
        prev = d;
      }
    }
    if (len < bestLen - 1) {
      bestLen = len;
      best = s;
    }
  }
  return best;
}

/** Straight-line miles from the middle of the starting state to the first mapped stop of the window,
 *  or to the middle of the trip's first state when none of those days is mapped. Rounded to 10. */
export function distanceFrom(fromState: string, it: EngineItinerary, windowStart: number, n: number): number | null {
  const home = STATE_CENTROIDS[fromState];
  if (!home) return null;
  for (let k = windowStart; k < windowStart + n; k++) {
    const d = it.days[k];
    if (d && d.lat != null && d.lon != null) return Math.round(haversineMiles(home.lat, home.lon, d.lat, d.lon) / 10) * 10;
  }
  const st = STATE_CENTROIDS[it.states[0]];
  if (st) return Math.round(haversineMiles(home.lat, home.lon, st.lat, st.lon) / 10) * 10;
  return null;
}

export function travelMode(miles: number | null): "Drive" | "Short flight" | "Long flight" | null {
  if (miles == null) return null;
  return miles <= REACH_MILES.drive ? "Drive" : miles <= REACH_MILES.hop ? "Short flight" : "Long flight";
}

export function stateNamesOf(slugs: string[]): string {
  return slugs.map((s) => STATE_CENTROIDS[s]?.name ?? s).join(", ");
}

// ---- the questions -------------------------------------------------------------------------
export const CATEGORY_LABEL: Record<string, string> = {
  nature: "Nature",
  city: "City",
  water: "Water",
  splurge: "Splurge",
  budget: "Budget",
  "road-trip": "Road trip",
  "off-the-beaten-path": "Off the path",
};

export type Duel = { a: string; b: string; aVotes: Record<string, number>; bVotes: Record<string, number> };

// Six this-or-that rounds. Each answer adds weight to itinerary categories; the weights are the whole
// "vibe" of the group.
export const DUELS: Duel[] = [
  { a: "Mountains", aVotes: { nature: 2 }, b: "Beach", bVotes: { water: 2 } },
  { a: "Street food", aVotes: { budget: 1, city: 1 }, b: "Tasting menu", bVotes: { splurge: 2 } },
  { a: "Sunrise hike", aVotes: { nature: 2 }, b: "Sleep till noon", bVotes: { city: 1, splurge: 1 } },
  { a: "Famous icon", aVotes: { city: 2 }, b: "Hidden gem", bVotes: { "off-the-beaten-path": 2 } },
  { a: "Drive somewhere", aVotes: { "road-trip": 2 }, b: "One comfy base", bVotes: { city: 1, splurge: 1 } },
  { a: "Cheap and wild", aVotes: { budget: 2, "off-the-beaten-path": 1 }, b: "Treat ourselves", bVotes: { splurge: 2 } },
];

export function votesFor(answers: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  answers.slice(0, DUELS.length).forEach((choice, i) => {
    const w = choice === 1 ? DUELS[i].bVotes : DUELS[i].aVotes;
    for (const k in w) out[k] = (out[k] ?? 0) + w[k];
  });
  return out;
}

export function sumVibe(all: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of all) for (const k in v) out[k] = (out[k] ?? 0) + v[k];
  return out;
}

/** A light, silly role for each friend from their own answers. */
const ROLE_BY_CATEGORY: Record<string, string> = {
  nature: "The Trailblazer",
  city: "The City Slicker",
  water: "The Beach Brain",
  "off-the-beaten-path": "The Chaos Agent",
  "road-trip": "The Co-Pilot",
  splurge: "The Treat-Yourself Captain",
  budget: "The Budget Boss",
};
export function roleFor(answers: number[]): string {
  const v = votesFor(answers);
  const entries = Object.entries(v).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (entries.length === 0) return "The Mystery Guest";
  return ROLE_BY_CATEGORY[entries[0][0]] ?? "The Mystery Guest";
}

// ---- the draw ------------------------------------------------------------------------------
export type DrawInput = {
  itineraries: EngineItinerary[];
  config: GameConfig;
  vibe: Record<string, number>;
  budget: number; // per person
  seed: number;
};

export function makeDeck(input: DrawInput): { cards: Card[]; meta: DeckMeta } {
  const { config, vibe, budget } = input;
  const N = config.days;
  const rnd = mulberry32(input.seed);
  type Scored = { it: EngineItinerary; w: number; cost: number; dist: number | null; inSeason: boolean | null; sc: number; cut: number };
  const all: Scored[] = [];
  for (const it of input.itineraries) {
    const w = bestWindow(it.days, N);
    if (w === null) continue;
    const dist = distanceFrom(config.fromState, it, w, N);
    const cost = estimateTripCost(N, it.tier);
    let sc = 0;
    for (const c of it.categories) sc += vibe[c] ?? 0;
    const inSeason = it.months.length === 0 ? null : it.months.includes(config.month);
    if (inSeason === true) sc += 2;
    else if (inSeason === false) sc -= 1;
    sc += cost <= budget ? 1 + 1.5 * (cost / budget) : -4 - (cost - budget) / 100;
    if (dist != null) sc += 1.2 * (1 - Math.min(dist, 2500) / 2500);
    const cut = it.days.length - N;
    if (cut > 3) sc -= 1;
    sc += rnd() * 1.6;
    all.push({ it, w, cost, dist, inSeason, sc, cut });
  }

  // reach: widen the radius when too few trips are inside it
  const order: Reach[] = ["drive", "hop", "any"];
  let ri = order.indexOf(config.reach);
  let pool: Scored[] = [];
  for (; ri < order.length; ri++) {
    const limit = REACH_MILES[order[ri]];
    pool = all.filter((x) => x.dist == null || x.dist <= limit);
    if (pool.length >= 3 || ri === order.length - 1) break;
  }
  const widenedTo = order[ri] !== config.reach ? order[ri] : null;

  // budget: keep what fits, and count what a bigger budget would unlock
  const fits = pool.filter((x) => x.cost <= budget * 1.15);
  const locked = pool.filter((x) => x.cost > budget * 1.15);
  const stretched = fits.length < 3;
  const use = (stretched ? pool.slice() : fits).sort((a, b) => b.sc - a.sc);

  const picked: Scored[] = [];
  if (use[0]) picked.push(use[0]);
  const rest = use.slice(1, 9);
  while (picked.length < 3 && rest.length) {
    const i = Math.floor(rnd() * Math.min(rest.length, 6));
    picked.push(rest.splice(i, 1)[0]);
  }

  const cards: Card[] = picked.map((p) => {
    const days = p.it.days.slice(p.w, p.w + N).map((d, k) => ({
      n: k + 1,
      title: d.title,
      activities: d.activities,
      eatTown: d.eatTown,
      lodging: d.lodging,
    }));
    const card: Card = {
      itineraryId: p.it.id,
      slug: p.it.slug,
      title: p.it.title,
      categories: p.it.categories,
      states: p.it.states,
      stateNames: stateNamesOf(p.it.states),
      windowStart: p.w,
      totalDays: p.it.days.length,
      cost: p.cost,
      tier: p.it.tier,
      distance: p.dist,
      overBudget: p.cost > budget,
      inSeason: p.inSeason,
      days,
      cover: p.it.cover,
      why: [],
    };
    card.why = whyChips(card, vibe, config);
    return card;
  });

  return {
    cards,
    meta: {
      widenedTo,
      stretched,
      lockedCount: stretched ? 0 : locked.length,
      lockedFrom: locked.length ? Math.min(...locked.map((x) => x.cost)) : 0,
    },
  };
}

export function whyChips(card: Card, vibe: Record<string, number>, config: GameConfig): Card["why"] {
  const out: Card["why"] = [];
  const matched = card.categories.filter((k) => (vibe[k] ?? 0) > 0);
  if (matched.length) out.push({ tone: "good", text: `Matches your ${matched.map((k) => (CATEGORY_LABEL[k] ?? k).toLowerCase()).join(" + ")} votes` });
  out.push({ tone: card.overBudget ? "bad" : "good", text: `About $${card.cost} each${card.overBudget ? ", over budget" : ""}` });
  if (card.distance != null) {
    out.push({ tone: "plain", text: `${card.distance < 30 ? "Right there" : `About ${card.distance} miles`} · ${travelMode(card.distance)}` });
  }
  if (card.inSeason === true) out.push({ tone: "good", text: `Good month: ${MONTHS[config.month]}` });
  else if (card.inSeason === false) out.push({ tone: "warn", text: "Not its best month" });
  if (card.totalDays > card.days.length) {
    out.push({ tone: "plain", text: `Days ${card.windowStart + 1} to ${card.windowStart + card.days.length} of a ${card.totalDays}-day trip` });
  }
  return out;
}

// ---- the vote ------------------------------------------------------------------------------
export type Ballot = { pick: number | null; veto: number | null };

export function pickWinner(
  ballots: Ballot[],
  cardCount: number,
  seed: number
): { winner: number; picks: number[]; vetoed: boolean[]; note: string } {
  const picks = Array.from({ length: cardCount }, () => 0);
  const vetoed = Array.from({ length: cardCount }, () => false);
  for (const b of ballots) {
    if (b.pick != null && b.pick >= 0 && b.pick < cardCount) picks[b.pick]++;
    if (b.veto != null && b.veto >= 0 && b.veto < cardCount) vetoed[b.veto] = true;
  }
  let live = vetoed.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  let note = "";
  if (live.length === 0) {
    live = picks.map((_, i) => i);
    note = "Every card was vetoed, so the vetoes are cancelled and the picks decide. ";
  }
  const best = Math.max(...live.map((i) => picks[i]));
  const tied = live.filter((i) => picks[i] === best);
  let winner = tied[0];
  if (best === 0) {
    winner = live[0];
    note += "Nobody picked, so the draw order decided.";
  } else if (tied.length > 1) {
    winner = tied[Math.floor(mulberry32(seed + 17)() * tied.length)];
    note += `Tie between ${tied.map((i) => "card " + "ABC"[i]).join(" and ")}, settled by a coin flip.`;
  } else {
    note += "Most picks wins.";
  }
  return { winner, picks, vetoed, note };
}

// ---- helpers the server uses to move a game forward ------------------------------------------
export function groupBudget(budgets: (number | null)[], fallback: number): { budget: number; bossIndex: number | null } {
  let min = Number.POSITIVE_INFINITY;
  let idx: number | null = null;
  budgets.forEach((b, i) => {
    if (b != null && b < min) {
      min = b;
      idx = i;
    }
  });
  return idx == null ? { budget: fallback, bossIndex: null } : { budget: min, bossIndex: idx };
}

export function validConfig(c: Partial<GameConfig> | null | undefined): c is GameConfig {
  return (
    !!c &&
    typeof c.fromState === "string" &&
    !!STATE_CENTROIDS[c.fromState] &&
    Number.isInteger(c.days) &&
    (c.days as number) >= 2 &&
    (c.days as number) <= 5 &&
    Number.isInteger(c.month) &&
    (c.month as number) >= 0 &&
    (c.month as number) <= 11 &&
    (c.reach === "drive" || c.reach === "hop" || c.reach === "any")
  );
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const n = raw.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 14);
  return n.length >= 1 ? n : null;
}

/** Plain-text summary for the group chat. */
export function shareText(card: Card, names: string[], config: GameConfig, fromName: string): string {
  const lines = [
    `Escape Hatch trip: ${card.title}`,
    `${card.days.length} days in ${MONTHS[config.month]} · about $${card.cost} each, not counting getting there`,
    card.distance != null ? `From ${fromName}: ${card.distance < 30 ? "right there" : `about ${card.distance} miles`} (straight line)` : "",
    `Crew: ${names.join(", ")}`,
    "",
  ].filter((l, i) => l !== "" || i === 4);
  for (const d of card.days) {
    lines.push(`Day ${d.n}: ${d.title}`);
    for (const a of d.activities) lines.push(`  - ${a}`);
  }
  lines.push("", "Planned on NextStamp. Still in? Confirm tomorrow.");
  return lines.join("\n");
}
