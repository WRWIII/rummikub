import { canHardDelete } from "./compute";
import {
  MAX_LEFTOVER,
  type Adjustment,
  type Match,
  type Player,
  type PlayerId,
  type Round,
  type RoundId,
} from "./types";

/**
 * Pure match mutations.
 *
 * No I/O and no Date.now() — timestamps and ids arrive in the action payload,
 * which makes every case trivially testable. This is the one part of the app
 * where a silent bug loses an argument at the table, so it is kept free of
 * anything that can't be asserted on.
 */

export type MatchAction =
  | { type: "addPlayer"; player: Player }
  | { type: "renamePlayer"; playerId: PlayerId; name: string }
  | { type: "retirePlayer"; playerId: PlayerId }
  | { type: "restorePlayer"; playerId: PlayerId }
  | { type: "removePlayer"; playerId: PlayerId }
  | { type: "reorderPlayers"; playerIds: PlayerId[] }
  | { type: "addRound"; round: Round }
  | { type: "editRound"; round: Round }
  | { type: "removeRound"; roundId: RoundId }
  | { type: "addAdjustment"; adjustment: Adjustment }
  | { type: "removeAdjustment"; adjustmentId: string }
  | { type: "resetMatch"; matchId: string; at: number }
  | { type: "clearAll"; matchId: string; at: number };

/**
 * Round validation. Surfaced in the entry sheet and enforced here, so an
 * invalid round can never reach storage.
 */
export function validateRound(round: Round, players: Player[]): string[] {
  const errors: string[] = [];
  const known = new Set(players.map((p) => p.id));

  if (round.participantIds.length < 2) {
    errors.push("A round needs at least two players.");
  }
  if (!round.participantIds.includes(round.winnerId)) {
    errors.push("The winner must be one of the players in the round.");
  }
  if (round.participantIds.some((id) => !known.has(id))) {
    errors.push("That round references a player who no longer exists.");
  }

  for (const id of round.participantIds) {
    if (id === round.winnerId) continue;
    const value = round.leftovers[id];
    // Blank is not zero. Treating an empty field as 0 silently corrupts
    // scores, so it has to be entered explicitly.
    if (value === undefined || value === null || Number.isNaN(value)) {
      errors.push("Every other player needs a tile value — enter 0 if they went out clean.");
      break;
    }
    if (!Number.isInteger(value) || value < 0 || value > MAX_LEFTOVER) {
      errors.push(`Tile values must be whole numbers between 0 and ${MAX_LEFTOVER}.`);
      break;
    }
  }

  return errors;
}

function withoutWinnerLeftover(round: Round): Round {
  // The winner's score is derived from the pot; a stray leftover entry for
  // them would be silently ignored, so strip it rather than store a lie.
  const leftovers: Record<PlayerId, number> = {};
  for (const id of round.participantIds) {
    if (id === round.winnerId) continue;
    leftovers[id] = round.leftovers[id] ?? 0;
  }
  return { ...round, leftovers };
}

export function matchReducer(match: Match, action: MatchAction): Match {
  switch (action.type) {
    case "addPlayer": {
      const name = action.player.name.trim();
      if (!name) return match;
      return { ...match, players: [...match.players, { ...action.player, name }] };
    }

    case "renamePlayer": {
      const name = action.name.trim();
      if (!name) return match;
      return {
        ...match,
        players: match.players.map((p) =>
          p.id === action.playerId ? { ...p, name } : p,
        ),
      };
    }

    case "retirePlayer":
      return {
        ...match,
        players: match.players.map((p) =>
          p.id === action.playerId ? { ...p, active: false } : p,
        ),
      };

    case "restorePlayer":
      return {
        ...match,
        players: match.players.map((p) =>
          p.id === action.playerId ? { ...p, active: true } : p,
        ),
      };

    case "removePlayer": {
      // Hard-deleting someone who appears in history orphans those rounds and
      // corrupts every total derived from them. Retire instead.
      if (!canHardDelete(match, action.playerId)) {
        return {
          ...match,
          players: match.players.map((p) =>
            p.id === action.playerId ? { ...p, active: false } : p,
          ),
        };
      }
      return {
        ...match,
        players: match.players.filter((p) => p.id !== action.playerId),
      };
    }

    case "reorderPlayers": {
      const byId = new Map(match.players.map((p) => [p.id, p]));
      const ordered = action.playerIds
        .map((id) => byId.get(id))
        .filter((p): p is Player => p !== undefined);
      // Anything the caller forgot stays, at the end.
      const missing = match.players.filter((p) => !action.playerIds.includes(p.id));
      return { ...match, players: [...ordered, ...missing] };
    }

    case "addRound": {
      const round = withoutWinnerLeftover(action.round);
      if (validateRound(round, match.players).length > 0) return match;
      return { ...match, rounds: [...match.rounds, round] };
    }

    case "editRound": {
      const round = withoutWinnerLeftover(action.round);
      if (validateRound(round, match.players).length > 0) return match;
      if (!match.rounds.some((r) => r.id === round.id)) return match;
      return {
        ...match,
        rounds: match.rounds.map((r) => (r.id === round.id ? round : r)),
      };
    }

    case "removeRound":
      return {
        ...match,
        rounds: match.rounds.filter((r) => r.id !== action.roundId),
      };

    case "addAdjustment": {
      if (!Number.isFinite(action.adjustment.delta) || action.adjustment.delta === 0) {
        return match;
      }
      return { ...match, adjustments: [...match.adjustments, action.adjustment] };
    }

    case "removeAdjustment":
      return {
        ...match,
        adjustments: match.adjustments.filter((a) => a.id !== action.adjustmentId),
      };

    case "resetMatch":
      // Keeps the roster. Clearing the roster is a separate, scarier action.
      return {
        ...match,
        id: action.matchId,
        createdAt: action.at,
        rounds: [],
        adjustments: [],
      };

    case "clearAll":
      return {
        v: 1,
        id: action.matchId,
        createdAt: action.at,
        players: [],
        rounds: [],
        adjustments: [],
      };

    default:
      return match;
  }
}
