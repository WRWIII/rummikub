"use client";

import { createStore } from "@/lib/store/create-store";
import {
  STORAGE_KEYS,
  createDebouncedWriter,
  readEnvelope,
  subscribeToKey,
  writeEnvelope,
} from "@/lib/persist/local-storage";
import { newId } from "@/lib/util/id";
import { computeTotals } from "./compute";
import { matchReducer, type MatchAction } from "./reducer";
import type {
  Match,
  MatchState,
  Player,
  PlayerId,
  Round,
  RoundId,
} from "./types";

const VERSION = 1;
const UNDO_LIMIT = 20;

/** The four tile colours, cycled so each player keeps a consistent one. */
export const PLAYER_COLORS = [
  "var(--color-ink-black)",
  "var(--color-ink-blue)",
  "var(--color-ink-red)",
  "var(--color-ink-orange)",
] as const;

function emptyMatch(): Match {
  return {
    v: 1,
    id: newId(),
    createdAt: Date.now(),
    players: [],
    rounds: [],
    adjustments: [],
  };
}

/* ------------------------------- migration ------------------------------- */

function coerceMatch(raw: unknown): Match | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.players) || !Array.isArray(r.rounds)) return null;

  const players: Player[] = r.players
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map((p, index) => ({
      id: String(p.id ?? newId()),
      name: String(p.name ?? `Player ${index + 1}`),
      colorIndex: Number(p.colorIndex ?? index) % PLAYER_COLORS.length,
      createdAt: Number(p.createdAt ?? Date.now()),
      active: p.active !== false,
    }));

  const knownIds = new Set(players.map((p) => p.id));

  const rounds: Round[] = r.rounds
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => {
      const participantIds = Array.isArray(x.participantIds)
        ? x.participantIds.map(String).filter((id) => knownIds.has(id))
        : [];
      const leftovers: Record<PlayerId, number> = {};
      if (typeof x.leftovers === "object" && x.leftovers !== null) {
        for (const [id, value] of Object.entries(x.leftovers)) {
          if (knownIds.has(id)) leftovers[id] = Number(value) || 0;
        }
      }
      return {
        id: String(x.id ?? newId()),
        at: Number(x.at ?? Date.now()),
        participantIds,
        winnerId: String(x.winnerId ?? participantIds[0] ?? ""),
        leftovers,
      };
    })
    // Drop anything that survived migration in an unusable state rather than
    // letting it poison every total.
    .filter((round) => round.winnerId && round.participantIds.includes(round.winnerId));

  const adjustments = Array.isArray(r.adjustments)
    ? r.adjustments
        .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
        .map((x) => ({
          id: String(x.id ?? newId()),
          at: Number(x.at ?? Date.now()),
          playerId: String(x.playerId ?? ""),
          delta: Number(x.delta ?? 0),
          note: typeof x.note === "string" ? x.note : undefined,
        }))
        .filter((a) => knownIds.has(a.playerId) && Number.isFinite(a.delta))
    : [];

  return {
    v: 1,
    id: String(r.id ?? newId()),
    createdAt: Number(r.createdAt ?? Date.now()),
    players,
    rounds,
    adjustments,
  };
}

/* --------------------------------- store --------------------------------- */

/**
 * The server snapshot is an explicit "unloaded" state, not an empty match.
 *
 * Prerendering a scoreboard of zeros would read as "my match got wiped", which
 * is far worse than a loading skeleton. Generalise: any persisted state whose
 * default is indistinguishable from plausible real data needs a not-loaded
 * server snapshot rather than a default value.
 */
export const MATCH_SERVER_SNAPSHOT: MatchState = Object.freeze({
  status: "unloaded" as const,
});

function loadInitial(): MatchState {
  if (typeof window === "undefined") return MATCH_SERVER_SNAPSHOT;
  const envelope = readEnvelope(STORAGE_KEYS.match);
  const match = envelope ? coerceMatch(envelope.data) : null;
  return { status: "ready", match: match ?? emptyMatch() };
}

export const matchStore = createStore<MatchState>(loadInitial());

const write = createDebouncedWriter<Match>(STORAGE_KEYS.match, VERSION);
matchStore.subscribe(() => {
  const state = matchStore.get();
  if (state.status === "ready") write(state.match);
});

if (typeof window !== "undefined") {
  subscribeToKey(STORAGE_KEYS.match, (envelope) => {
    const match = envelope ? coerceMatch(envelope.data) : null;
    if (match) matchStore.set({ status: "ready", match });
  });
}

/* ---------------------------------- undo --------------------------------- */

const undoStack: Match[] = [];

function currentMatch(): Match | null {
  const state = matchStore.get();
  return state.status === "ready" ? state.match : null;
}

/**
 * One generic undo mechanism covers undo-round, undo-rename, undo-correction
 * and undo-reset. Three bespoke undo paths would be strictly more code and far
 * easier to get wrong with a phone being passed around.
 */
export function dispatch(action: MatchAction): void {
  const match = currentMatch();
  if (!match) return;

  const next = matchReducer(match, action);
  if (next === match) return;

  undoStack.push(match);
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();

  // Persist only the most recent snapshot, so the scariest operation — Reset
  // Match — stays undoable even after a reload. The full stack would double
  // storage for little gain.
  writeEnvelope(STORAGE_KEYS.matchPrevious, VERSION, match);

  matchStore.set({ status: "ready", match: next });
}

export function canUndo(): boolean {
  if (undoStack.length > 0) return true;
  return readEnvelope(STORAGE_KEYS.matchPrevious) !== null;
}

export function undo(): void {
  const previous = undoStack.pop();
  if (previous) {
    matchStore.set({ status: "ready", match: previous });
    return;
  }
  // Nothing in memory — fall back to the persisted snapshot so an undo still
  // works after a reload.
  const envelope = readEnvelope(STORAGE_KEYS.matchPrevious);
  const restored = envelope ? coerceMatch(envelope.data) : null;
  if (restored) matchStore.set({ status: "ready", match: restored });
}

/* ------------------------------ action creators --------------------------- */

export function addPlayer(name: string): void {
  const match = currentMatch();
  if (!match) return;
  dispatch({
    type: "addPlayer",
    player: {
      id: newId(),
      name,
      colorIndex: match.players.length % PLAYER_COLORS.length,
      createdAt: Date.now(),
      active: true,
    },
  });
}

export function renamePlayer(playerId: PlayerId, name: string): void {
  dispatch({ type: "renamePlayer", playerId, name });
}

export function retirePlayer(playerId: PlayerId): void {
  dispatch({ type: "retirePlayer", playerId });
}

export function restorePlayer(playerId: PlayerId): void {
  dispatch({ type: "restorePlayer", playerId });
}

export function removePlayer(playerId: PlayerId): void {
  dispatch({ type: "removePlayer", playerId });
}

export function saveRound(
  winnerId: PlayerId,
  participantIds: PlayerId[],
  leftovers: Record<PlayerId, number>,
  roundId?: RoundId,
): void {
  const round: Round = {
    id: roundId ?? newId(),
    at: Date.now(),
    participantIds,
    winnerId,
    leftovers,
  };
  dispatch(roundId ? { type: "editRound", round } : { type: "addRound", round });
}

export function removeRound(roundId: RoundId): void {
  dispatch({ type: "removeRound", roundId });
}

/**
 * "Set Alice's total to X". Appends a correction rather than rewriting a
 * round, so totals stay a pure fold and the change is visible in history.
 */
export function setPlayerTotal(playerId: PlayerId, target: number): void {
  const match = currentMatch();
  if (!match) return;
  const current = computeTotals(match)[playerId] ?? 0;
  const delta = target - current;
  if (delta === 0) return;
  dispatch({
    type: "addAdjustment",
    adjustment: {
      id: newId(),
      at: Date.now(),
      playerId,
      delta,
      note: "Manual correction",
    },
  });
}

export function removeAdjustment(adjustmentId: string): void {
  dispatch({ type: "removeAdjustment", adjustmentId });
}

export function resetMatch(): void {
  dispatch({ type: "resetMatch", matchId: newId(), at: Date.now() });
}

export function clearAll(): void {
  dispatch({ type: "clearAll", matchId: newId(), at: Date.now() });
}

export function importMatch(match: Match): void {
  const coerced = coerceMatch(match);
  if (!coerced) return;
  const current = currentMatch();
  if (current) {
    undoStack.push(current);
    writeEnvelope(STORAGE_KEYS.matchPrevious, VERSION, current);
  }
  matchStore.set({ status: "ready", match: coerced });
}
