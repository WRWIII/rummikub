export type PlayerId = string;
export type RoundId = string;

export interface Player {
  id: PlayerId;
  name: string;
  /** Index into a fixed palette, so a player keeps their colour. */
  colorIndex: number;
  createdAt: number;
  /** false = retired. Kept so history stays intact. */
  active: boolean;
}

/**
 * A round stores INPUTS ONLY — who won, and what everyone else was left
 * holding. Every score is derived from that.
 *
 * This is the one modelling decision that matters. Storing per-player scores
 * instead means correcting a mistyped leftover requires touching two records
 * (the loser's negative and the winner's positive) and they inevitably drift
 * apart. Derived scores can't drift.
 */
export interface Round {
  id: RoundId;
  at: number;
  participantIds: PlayerId[];
  winnerId: PlayerId;
  /** Non-winner -> positive tile value they were left holding. */
  leftovers: Record<PlayerId, number>;
}

/**
 * A manual correction. Hand-editing a total never rewrites a round — it
 * appends one of these, so totals stay a pure fold and the change is visible
 * and reversible.
 */
export interface Adjustment {
  id: string;
  at: number;
  playerId: PlayerId;
  delta: number;
  note?: string;
}

export interface Match {
  v: 1;
  id: string;
  createdAt: number;
  players: Player[];
  rounds: Round[];
  adjustments: Adjustment[];
}

export interface Standing {
  player: Player;
  total: number;
  roundsWon: number;
  adjustmentTotal: number;
  /** 1-based. Ties share a rank. */
  rank: number;
}

/** What the scoring screen renders before the client store has hydrated. */
export type MatchState =
  | { status: "unloaded" }
  | { status: "ready"; match: Match };

export const MAX_LEFTOVER = 999;
/** A Rummikub hand tops out around here; more usually means a typo. */
export const SUSPICIOUS_LEFTOVER = 200;
