import type { Match, PlayerId, Round, Standing } from "./types";

/**
 * Derivations. All pure, all memoised on the identity of the Match object, so
 * calling them during render is free and there is no derived state to keep in
 * sync.
 *
 * The memo also matters for correctness: useSyncExternalStore selectors must
 * return stable references, and a selector that built a fresh standings array
 * on every read would trip React's cached-snapshot check.
 */

/** Rummikub scoring: losers go negative, the winner takes the sum. */
export function roundDeltas(round: Round): Record<PlayerId, number> {
  const deltas: Record<PlayerId, number> = {};
  let pot = 0;

  for (const id of round.participantIds) {
    if (id === round.winnerId) continue;
    const leftover = round.leftovers[id] ?? 0;
    // Negating zero yields -0, which is harmless arithmetically but a sharp
    // edge everywhere else (Object.is, JSON round-trips, formatting).
    deltas[id] = leftover === 0 ? 0 : -leftover;
    pot += leftover;
  }

  deltas[round.winnerId] = pot;
  return deltas;
}

const totalsCache = new WeakMap<Match, Record<PlayerId, number>>();
const standingsCache = new WeakMap<Match, Standing[]>();

export function computeTotals(match: Match): Record<PlayerId, number> {
  const cached = totalsCache.get(match);
  if (cached) return cached;

  const totals: Record<PlayerId, number> = {};
  for (const player of match.players) totals[player.id] = 0;

  for (const round of match.rounds) {
    const deltas = roundDeltas(round);
    for (const [id, delta] of Object.entries(deltas)) {
      totals[id] = (totals[id] ?? 0) + delta;
    }
  }

  for (const adjustment of match.adjustments) {
    totals[adjustment.playerId] =
      (totals[adjustment.playerId] ?? 0) + adjustment.delta;
  }

  totalsCache.set(match, totals);
  return totals;
}

export function computeStandings(match: Match): Standing[] {
  const cached = standingsCache.get(match);
  if (cached) return cached;

  const totals = computeTotals(match);

  const roundsWon: Record<PlayerId, number> = {};
  for (const round of match.rounds) {
    roundsWon[round.winnerId] = (roundsWon[round.winnerId] ?? 0) + 1;
  }

  const adjustmentTotals: Record<PlayerId, number> = {};
  for (const adjustment of match.adjustments) {
    adjustmentTotals[adjustment.playerId] =
      (adjustmentTotals[adjustment.playerId] ?? 0) + adjustment.delta;
  }

  const rows = match.players
    .map((player) => ({
      player,
      total: totals[player.id] ?? 0,
      roundsWon: roundsWon[player.id] ?? 0,
      adjustmentTotal: adjustmentTotals[player.id] ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.total - a.total || a.player.name.localeCompare(b.player.name));

  // Ties share a rank: 1, 2, 2, 4.
  rows.forEach((row, index) => {
    row.rank =
      index > 0 && rows[index - 1].total === row.total
        ? rows[index - 1].rank
        : index + 1;
  });

  standingsCache.set(match, rows);
  return rows;
}

/** The live "winner gets +N" readout while a round is being entered. */
export function potFromLeftovers(leftovers: Record<PlayerId, number>): number {
  return Object.values(leftovers).reduce((sum, value) => sum + (value || 0), 0);
}

export function canHardDelete(match: Match, playerId: PlayerId): boolean {
  return (
    !match.rounds.some((round) => round.participantIds.includes(playerId)) &&
    !match.adjustments.some((adjustment) => adjustment.playerId === playerId)
  );
}
