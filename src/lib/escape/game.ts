// Escape Hatch server logic: creates rooms, lets friends join, and moves a game through its phases.
// Every rule lives here, on the server. A phone can only ask; this decides. Secrets (each friend's
// duel answers, picks and vetoes) never leave this file until the game reveals them.
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CostTier } from "@/lib/costs";
import {
  CATEGORY_LABEL,
  cleanName,
  DUELS,
  groupBudget,
  makeDeck,
  pickWinner,
  roleFor,
  shareText,
  sumVibe,
  validConfig,
  votesFor,
  type Ballot,
  type Card,
  type DeckMeta,
  type EngineItinerary,
  type GameConfig,
} from "./engine";
import { STATE_CENTROIDS } from "./stateCentroids";

export type Phase = "lobby" | "duels" | "draw" | "vote" | "pact" | "done";
export const MAX_PLAYERS = 8;
export const DEFAULT_BUDGET = 400;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ"; // no I, L or O: they read like 1 and 0
const KEEP_DAYS = 7;

type Result = {
  vibe: Record<string, number>;
  budget: number;
  bossName: string | null;
  roles: Record<string, string>; // playerId -> role
  meta: DeckMeta;
  count?: { winner: number; note: string; tied?: number[]; picks: number[]; vetoed: boolean[]; ballots: { name: string; pick: number | null; veto: number | null }[] };
  shared?: boolean;
};

export type GameView = {
  version: string;
  code: string;
  phase: Phase;
  config: GameConfig;
  fromName: string;
  you: { id: string; name: string; isHost: boolean; duelsDone: boolean; voted: boolean; committed: boolean; pick: number | null; veto: number | null };
  players: { id: string; name: string; isHost: boolean; duelsDone: boolean; voted: boolean; committed: boolean; role: string | null }[];
  groupBudget: number | null;
  budgetBoss: string | null;
  vibeTop: string[];
  cards: Card[] | null;
  meta: DeckMeta | null;
  redrawsLeft: number;
  count: Result["count"] | null;
  pass: { card: Card; crew: string[]; text: string; shared: boolean } | null;
};

export class GameError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---- itineraries ---------------------------------------------------------------------------
let cache: { at: number; rows: EngineItinerary[] } | null = null;

export async function loadItineraries(): Promise<EngineItinerary[]> {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.rows;
  const rows = await prisma.itinerary.findMany({
    where: { countries: "USA", isPublic: true },
    include: { days: { orderBy: { dayNumber: "asc" } } },
  });
  const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const mapped: EngineItinerary[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    tier: (["budget", "mid", "splurge"].includes(r.costTier) ? r.costTier : "mid") as CostTier,
    categories: r.category.split(",").map((s) => s.trim()).filter(Boolean),
    months: r.bestTimeMonths
      .split(",")
      .map((m) => MONTHS.indexOf(m.trim().toLowerCase()))
      .filter((i) => i >= 0),
    states: (r.relatedStateSlugs ?? "").split(",").map((s) => s.trim()).filter((s) => !!STATE_CENTROIDS[s]),
    days: r.days.map((d) => ({
      title: d.title,
      activities: d.activities.split("|").map((a) => a.trim()).filter(Boolean),
      lat: d.latitude,
      lon: d.longitude,
      eatTown: d.eatTown,
      lodging: d.lodgingSuggestion,
    })),
    cover: r.coverImageUrl,
  }));
  cache = { at: Date.now(), rows: mapped };
  return mapped;
}

// ---- helpers -------------------------------------------------------------------------------
function randomCode(): string {
  const bytes = randomBytes(5);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}
const newToken = () => randomBytes(18).toString("hex");
const json = (v: unknown) => v as unknown as Prisma.InputJsonValue;
const result = (g: { result: unknown }): Result | null => (g.result as Result | null) ?? null;
const deckOf = (g: { deck: unknown }): Card[] | null => (g.deck as Card[] | null) ?? null;
const configOf = (g: { config: unknown }): GameConfig => g.config as GameConfig;
const answersOf = (p: { duels: unknown }): number[] | null => (Array.isArray(p.duels) ? (p.duels as number[]) : null);

async function getGame(code: string) {
  const game = await prisma.escapeGame.findUnique({ where: { code: code.toUpperCase() }, include: { players: { orderBy: { joinedAt: "asc" } } } });
  if (!game) throw new GameError(404, "No game with that code. Check it and try again.");
  return game;
}
type Loaded = Awaited<ReturnType<typeof getGame>>;
const touch = (id: string) => prisma.escapeGame.update({ where: { id }, data: { updatedAt: new Date() } });

// ---- create and join -----------------------------------------------------------------------
export async function createGame(hostName: unknown, fromState: unknown): Promise<{ code: string; token: string }> {
  const name = cleanName(hostName);
  if (!name) throw new GameError(400, "Type your first name.");
  const from = typeof fromState === "string" && STATE_CENTROIDS[fromState] ? fromState : "illinois";
  // tidy: week-old rooms go away (their players go with them)
  await prisma.escapeGame.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86400000) } } });
  const config: GameConfig = { fromState: from, days: 3, month: new Date().getMonth(), reach: "hop" };
  const token = newToken();
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const game = await prisma.escapeGame.create({
        data: {
          code: randomCode(),
          config: json(config),
          seed: Math.floor(Math.random() * 1e9) + 1,
          players: { create: { name, token, isHost: true } },
        },
      });
      return { code: game.code, token };
    } catch (e) {
      if (attempt === 5) throw e; // a code collision is the only expected failure; retry
    }
  }
  throw new GameError(500, "Could not make a room. Try again.");
}

export async function joinGame(code: string, rawName: unknown): Promise<{ token: string }> {
  const game = await getGame(code);
  const name = cleanName(rawName);
  if (!name) throw new GameError(400, "Type your first name.");
  if (game.phase !== "lobby") throw new GameError(409, "That game has already started. Ask the host to start a rematch.");
  if (game.players.length >= MAX_PLAYERS) throw new GameError(409, "That room is full.");
  if (game.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new GameError(409, "Someone in that room already has that name. Try another.");
  const token = newToken();
  await prisma.escapePlayer.create({ data: { gameId: game.id, name, token } });
  await touch(game.id);
  return { token };
}

// ---- the view a player gets ---------------------------------------------------------------------
export async function viewFor(code: string, token: string | null, sinceVersion?: string | null): Promise<GameView | { unchanged: true }> {
  const game = await getGame(code);
  const me = token ? game.players.find((p) => p.token === token) : null;
  if (!me) throw new GameError(403, "You are not in this game.");
  const version = `${game.updatedAt.getTime()}:${game.players.length}`;
  if (sinceVersion && sinceVersion === version) return { unchanged: true };

  const config = configOf(game);
  const res = result(game);
  const cards = deckOf(game);
  const revealed = game.phase === "pact" || game.phase === "done";
  const winnerCard = revealed && res?.count && cards ? cards[res.count.winner] : null;
  const names = game.players.map((p) => p.name);
  const done = game.phase === "done" && winnerCard;
  const committedNames = game.players.filter((p) => p.committed).map((p) => p.name);
  const vibeTop = res
    ? Object.entries(res.vibe).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => CATEGORY_LABEL[k] ?? k)
    : [];
  return {
    version,
    code: game.code,
    phase: game.phase as Phase,
    config,
    fromName: STATE_CENTROIDS[config.fromState]?.name ?? config.fromState,
    you: { id: me.id, name: me.name, isHost: me.isHost, duelsDone: !!answersOf(me), voted: me.voted, committed: me.committed, pick: me.pick, veto: me.veto },
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      duelsDone: !!answersOf(p),
      voted: p.voted,
      committed: p.committed,
      role: res?.roles?.[p.id] ?? null,
    })),
    groupBudget: res?.budget ?? null,
    budgetBoss: res?.bossName ?? null,
    vibeTop,
    cards: cards && game.phase !== "lobby" && game.phase !== "duels" ? cards : null,
    meta: res?.meta ?? null,
    redrawsLeft: Math.max(0, 2 - game.redraws),
    count: revealed && res?.count ? res.count : null,
    pass: done
      ? {
          card: winnerCard as Card,
          crew: committedNames.length ? committedNames : names,
          text: shareText(winnerCard as Card, committedNames.length ? committedNames : names, config, STATE_CENTROIDS[config.fromState]?.name ?? config.fromState),
          shared: !!res?.shared,
        }
      : null,
  };
}

// ---- actions -------------------------------------------------------------------------------
export type Action =
  | { type: "config"; config: Partial<GameConfig> }
  | { type: "start" }
  | { type: "duels"; answers: number[]; budget: number }
  | { type: "deal" }
  | { type: "redraw" }
  | { type: "open_vote" }
  | { type: "ballot"; pick: number | null; veto: number | null }
  | { type: "count" }
  | { type: "commit" }
  | { type: "finish" }
  | { type: "again" }
  | { type: "share"; wish?: string };

export async function act(code: string, token: string | null, action: Action): Promise<void> {
  const game = await getGame(code);
  const me = token ? game.players.find((p) => p.token === token) : null;
  if (!me) throw new GameError(403, "You are not in this game.");
  const hostOnly = () => {
    if (!me.isHost) throw new GameError(403, "Only the host can do that.");
  };

  switch (action.type) {
    case "config": {
      hostOnly();
      if (game.phase !== "lobby") throw new GameError(409, "The game has started.");
      const next = { ...configOf(game), ...action.config };
      if (!validConfig(next)) throw new GameError(400, "Those settings are not valid.");
      await prisma.escapeGame.update({ where: { id: game.id }, data: { config: json(next) } });
      return;
    }
    case "start": {
      hostOnly();
      if (game.phase !== "lobby") throw new GameError(409, "Already started.");
      if (game.players.length < 2) throw new GameError(409, "You need at least two players.");
      await prisma.escapePlayer.updateMany({ where: { gameId: game.id }, data: { duels: undefined, budget: null, pick: null, veto: null, voted: false, committed: false } });
      await prisma.escapeGame.update({ where: { id: game.id }, data: { phase: "duels", deck: undefined, result: undefined } });
      return;
    }
    case "duels": {
      if (game.phase !== "duels") throw new GameError(409, "Not the questions round.");
      const ans = action.answers;
      if (!Array.isArray(ans) || ans.length !== DUELS.length || !ans.every((a) => a === 0 || a === 1)) throw new GameError(400, "Answer every duel.");
      const b = Number(action.budget);
      const budget = Number.isFinite(b) ? Math.min(1500, Math.max(100, Math.round(b / 50) * 50)) : DEFAULT_BUDGET;
      await prisma.escapePlayer.update({ where: { id: me.id }, data: { duels: json(ans), budget } });
      await touch(game.id);
      await maybeDeal(game.id, false);
      return;
    }
    case "deal": {
      hostOnly();
      if (game.phase !== "duels") throw new GameError(409, "Not the questions round.");
      if (game.players.filter((p) => answersOf(p)).length < 2) throw new GameError(409, "At least two friends need to finish first.");
      await maybeDeal(game.id, true);
      return;
    }
    case "redraw": {
      hostOnly();
      if (game.phase !== "draw") throw new GameError(409, "Nothing to redraw.");
      if (game.redraws >= 2) throw new GameError(409, "No redraws left.");
      const res = result(game);
      if (!res) throw new GameError(409, "Nothing to redraw.");
      const its = await loadItineraries();
      const { cards, meta } = makeDeck({ itineraries: its, config: configOf(game), vibe: res.vibe, budget: res.budget, seed: game.seed + 101 * (game.redraws + 1) });
      await prisma.escapeGame.update({ where: { id: game.id }, data: { deck: json(cards), result: json({ ...res, meta }), redraws: { increment: 1 } } });
      return;
    }
    case "open_vote": {
      hostOnly();
      if (game.phase !== "draw") throw new GameError(409, "Not the draw.");
      if ((deckOf(game) ?? []).length < 2) throw new GameError(409, "Not enough cards to vote on. Redraw or change the settings.");
      await prisma.escapeGame.update({ where: { id: game.id }, data: { phase: "vote" } });
      return;
    }
    case "ballot": {
      if (game.phase !== "vote") throw new GameError(409, "Not the voting round.");
      const n = (deckOf(game) ?? []).length;
      const ok = (v: unknown) => v === null || (Number.isInteger(v) && (v as number) >= 0 && (v as number) < n);
      if (!ok(action.pick) || !ok(action.veto)) throw new GameError(400, "That card does not exist.");
      if (action.pick !== null && action.pick === action.veto) throw new GameError(400, "You cannot pick and veto the same card.");
      await prisma.escapePlayer.update({ where: { id: me.id }, data: { pick: action.pick, veto: action.veto, voted: true } });
      await touch(game.id);
      await maybeCount(game.id, false);
      return;
    }
    case "count": {
      hostOnly();
      if (game.phase !== "vote") throw new GameError(409, "Not the voting round.");
      await maybeCount(game.id, true);
      return;
    }
    case "commit": {
      if (game.phase !== "pact") throw new GameError(409, "Not the pact.");
      await prisma.escapePlayer.update({ where: { id: me.id }, data: { committed: true } });
      await touch(game.id);
      await maybeFinish(game.id, false);
      return;
    }
    case "finish": {
      hostOnly();
      if (game.phase !== "pact") throw new GameError(409, "Not the pact.");
      await maybeFinish(game.id, true);
      return;
    }
    case "again": {
      hostOnly();
      if (game.phase === "lobby") return;
      await prisma.escapePlayer.updateMany({ where: { gameId: game.id }, data: { duels: undefined, budget: null, pick: null, veto: null, voted: false, committed: false } });
      await prisma.escapeGame.update({ where: { id: game.id }, data: { phase: "lobby", deck: undefined, result: undefined, redraws: 0, seed: Math.floor(Math.random() * 1e9) + 1 } });
      return;
    }
    case "share": {
      hostOnly();
      if (game.phase !== "done") throw new GameError(409, "Finish the game first.");
      const res = result(game);
      const cards = deckOf(game);
      if (!res || !cards || !res.count || res.shared) return;
      const config = configOf(game);
      const wish = typeof action.wish === "string" ? action.wish.replace(/\s+/g, " ").trim().slice(0, 140) : "";
      await prisma.escapeOutcome.create({
        data: {
          fromState: config.fromState,
          days: config.days,
          month: config.month,
          budget: res.budget,
          reach: config.reach,
          playerCount: game.players.length,
          vibe: json(res.vibe),
          titles: json(cards.map((c) => c.title)),
          winnerTitle: cards[res.count.winner]?.title ?? null,
          vetoedTitles: json(cards.filter((_, i) => res.count!.vetoed[i]).map((c) => c.title)),
          nothingFit: cards.length === 0,
          wish: wish || null,
        },
      });
      await prisma.escapeGame.update({ where: { id: game.id }, data: { result: json({ ...res, shared: true }) } });
      return;
    }
    default:
      throw new GameError(400, "Unknown action.");
  }
}

// ---- phase transitions (guarded so two phones finishing at once cannot double-fire) -----------------
async function maybeDeal(gameId: string, force: boolean) {
  const game = await prisma.escapeGame.findUnique({ where: { id: gameId }, include: { players: { orderBy: { joinedAt: "asc" } } } });
  if (!game || game.phase !== "duels") return;
  const done = game.players.filter((p) => answersOf(p));
  if (!force && done.length < game.players.length) return;
  if (done.length < 2) return;
  const claimed = await prisma.escapeGame.updateMany({ where: { id: gameId, phase: "duels" }, data: { phase: "draw", updatedAt: new Date() } });
  if (claimed.count !== 1) return;
  const config = configOf(game);
  const vibe = sumVibe(done.map((p) => votesFor(answersOf(p) as number[])));
  const { budget, bossIndex } = groupBudget(done.map((p) => p.budget), DEFAULT_BUDGET);
  const roles: Record<string, string> = {};
  for (const p of done) roles[p.id] = roleFor(answersOf(p) as number[]);
  const its = await loadItineraries();
  const { cards, meta } = makeDeck({ itineraries: its, config, vibe, budget, seed: game.seed });
  const res: Result = { vibe, budget, bossName: bossIndex == null ? null : done[bossIndex].name, roles, meta };
  await prisma.escapeGame.update({ where: { id: gameId }, data: { deck: json(cards), result: json(res) } });
}

async function maybeCount(gameId: string, force: boolean) {
  const game = await prisma.escapeGame.findUnique({ where: { id: gameId }, include: { players: { orderBy: { joinedAt: "asc" } } } });
  if (!game || game.phase !== "vote") return;
  const voted = game.players.filter((p) => p.voted);
  if (!force && voted.length < game.players.length) return;
  if (voted.length < 1) throw new GameError(409, "Nobody has voted yet.");
  const claimed = await prisma.escapeGame.updateMany({ where: { id: gameId, phase: "vote" }, data: { phase: "pact", updatedAt: new Date() } });
  if (claimed.count !== 1) return;
  const cards = deckOf(game) ?? [];
  const ballots: Ballot[] = voted.map((p) => ({ pick: p.pick, veto: p.veto }));
  const w = pickWinner(ballots, cards.length, game.seed);
  const res = result(game) as Result;
  res.count = {
    winner: w.winner,
    note: w.note,
    tied: w.tied,
    picks: w.picks,
    vetoed: w.vetoed,
    ballots: voted.map((p) => ({ name: p.name, pick: p.pick, veto: p.veto })),
  };
  await prisma.escapeGame.update({ where: { id: gameId }, data: { result: json(res) } });
}

async function maybeFinish(gameId: string, force: boolean) {
  const game = await prisma.escapeGame.findUnique({ where: { id: gameId }, include: { players: true } });
  if (!game || game.phase !== "pact") return;
  const committed = game.players.filter((p) => p.committed);
  if (!force && committed.length < game.players.length) return;
  if (committed.length < 1) throw new GameError(409, "Nobody has committed yet.");
  await prisma.escapeGame.updateMany({ where: { id: gameId, phase: "pact" }, data: { phase: "done", updatedAt: new Date() } });
}
