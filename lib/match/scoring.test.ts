import { describe, expect, it } from "vitest";
import { canHardDelete, computeStandings, computeTotals, roundDeltas } from "./compute";
import { matchReducer, validateRound, type MatchAction } from "./reducer";
import type { Match, Player, Round } from "./types";

function player(id: string, name: string, index: number): Player {
  return { id, name, colorIndex: index, createdAt: 0, active: true };
}

const ALICE = player("a", "Alice", 0);
const BOB = player("b", "Bob", 1);
const CARL = player("c", "Carl", 2);

function emptyMatch(players: Player[] = [ALICE, BOB, CARL]): Match {
  return { v: 1, id: "m", createdAt: 0, players, rounds: [], adjustments: [] };
}

function round(
  id: string,
  winnerId: string,
  leftovers: Record<string, number>,
  participantIds = ["a", "b", "c"],
): Round {
  return { id, at: 0, participantIds, winnerId, leftovers };
}

function apply(match: Match, ...actions: MatchAction[]): Match {
  return actions.reduce(matchReducer, match);
}

describe("roundDeltas", () => {
  it("gives the winner the sum of everyone else's leftovers", () => {
    const deltas = roundDeltas(round("r1", "b", { a: 42, c: 25 }));
    expect(deltas).toEqual({ a: -42, c: -25, b: 67 });
  });

  it("sums to zero, so points are only ever moved around", () => {
    const deltas = roundDeltas(round("r1", "b", { a: 42, c: 25 }));
    expect(Object.values(deltas).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("treats an explicit zero as a real value, not a missing one", () => {
    // Someone who went out clean but didn't win still scores 0, and
    // contributes nothing to the pot.
    const deltas = roundDeltas(round("r1", "b", { a: 0, c: 25 }));
    expect(deltas).toEqual({ a: 0, c: -25, b: 25 });
  });

  it("handles a two-player round", () => {
    const deltas = roundDeltas(round("r1", "a", { b: 30 }, ["a", "b"]));
    expect(deltas).toEqual({ a: 30, b: -30 });
  });
});

describe("computeTotals", () => {
  it("folds multiple rounds", () => {
    const match = apply(
      emptyMatch(),
      { type: "addRound", round: round("r1", "b", { a: 42, c: 25 }) },
      { type: "addRound", round: round("r2", "a", { b: 10, c: 5 }) },
    );
    expect(computeTotals(match)).toEqual({ a: -27, b: 57, c: -30 });
  });

  it("applies manual corrections on top", () => {
    const match = apply(
      emptyMatch(),
      { type: "addRound", round: round("r1", "b", { a: 42, c: 25 }) },
      {
        type: "addAdjustment",
        adjustment: { id: "adj", at: 0, playerId: "a", delta: 12 },
      },
    );
    expect(computeTotals(match).a).toBe(-30);
  });

  it("returns a stable reference so selectors can't loop", () => {
    const match = apply(emptyMatch(), {
      type: "addRound",
      round: round("r1", "b", { a: 1, c: 2 }),
    });
    expect(computeTotals(match)).toBe(computeTotals(match));
  });
});

describe("editing a round", () => {
  it("re-derives BOTH the loser's negative and the winner's positive", () => {
    // This is the whole reason rounds store inputs rather than scores.
    let match = apply(emptyMatch(), {
      type: "addRound",
      round: round("r1", "b", { a: 42, c: 25 }),
    });
    expect(computeTotals(match)).toEqual({ a: -42, b: 67, c: -25 });

    match = apply(match, {
      type: "editRound",
      round: round("r1", "b", { a: 12, c: 25 }),
    });
    expect(computeTotals(match)).toEqual({ a: -12, b: 37, c: -25 });
  });

  it("ignores an edit to a round that isn't there", () => {
    const match = emptyMatch();
    expect(matchReducer(match, {
      type: "editRound",
      round: round("nope", "b", { a: 1, c: 2 }),
    })).toBe(match);
  });

  it("strips a stray leftover recorded against the winner", () => {
    const match = apply(emptyMatch(), {
      type: "addRound",
      round: round("r1", "b", { a: 10, b: 99, c: 5 }),
    });
    expect(match.rounds[0].leftovers).toEqual({ a: 10, c: 5 });
    expect(computeTotals(match).b).toBe(15);
  });
});

describe("validateRound", () => {
  const roster = [ALICE, BOB, CARL];

  it("accepts a well-formed round", () => {
    expect(validateRound(round("r", "b", { a: 5, c: 5 }), roster)).toEqual([]);
  });

  it("rejects a blank leftover rather than reading it as zero", () => {
    const bad = round("r", "b", { a: Number.NaN, c: 5 });
    expect(validateRound(bad, roster).length).toBeGreaterThan(0);
  });

  it("rejects a winner who wasn't in the round", () => {
    const bad = round("r", "c", { a: 5, b: 5 }, ["a", "b"]);
    expect(validateRound(bad, roster).length).toBeGreaterThan(0);
  });

  it("rejects negative and non-integer tile values", () => {
    expect(validateRound(round("r", "b", { a: -5, c: 5 }), roster).length).toBeGreaterThan(0);
    expect(validateRound(round("r", "b", { a: 5.5, c: 5 }), roster).length).toBeGreaterThan(0);
  });

  it("blocks an invalid round from ever reaching the match", () => {
    const match = emptyMatch();
    expect(matchReducer(match, {
      type: "addRound",
      round: round("r", "b", { a: Number.NaN, c: 5 }),
    })).toBe(match);
  });
});

describe("player lifecycle", () => {
  it("retires rather than deletes a player who appears in history", () => {
    const match = apply(
      emptyMatch(),
      { type: "addRound", round: round("r1", "b", { a: 42, c: 25 }) },
      { type: "removePlayer", playerId: "a" },
    );
    // Still present, so the round and every total stay intact.
    expect(match.players.find((p) => p.id === "a")?.active).toBe(false);
    expect(computeTotals(match).b).toBe(67);
  });

  it("hard-deletes a player with no history", () => {
    const match = apply(emptyMatch(), { type: "removePlayer", playerId: "a" });
    expect(match.players.find((p) => p.id === "a")).toBeUndefined();
    expect(canHardDelete(emptyMatch(), "a")).toBe(true);
  });

  it("propagates a rename through history, because rounds store ids", () => {
    const match = apply(
      emptyMatch(),
      { type: "addRound", round: round("r1", "b", { a: 42, c: 25 }) },
      { type: "renamePlayer", playerId: "b", name: "Roberta" },
    );
    expect(match.players.find((p) => p.id === "b")?.name).toBe("Roberta");
    expect(match.rounds[0].winnerId).toBe("b");
    expect(computeTotals(match).b).toBe(67);
  });
});

describe("standings", () => {
  it("ranks by total and shares a rank on a tie", () => {
    const match = apply(
      emptyMatch(),
      { type: "addRound", round: round("r1", "a", { b: 10, c: 10 }) },
    );
    const standings = computeStandings(match);
    expect(standings[0].player.id).toBe("a");
    expect(standings[0].total).toBe(20);
    // Bob and Carl are both on -10.
    expect(standings[1].rank).toBe(2);
    expect(standings[2].rank).toBe(2);
  });

  it("counts wins", () => {
    const match = apply(
      emptyMatch(),
      { type: "addRound", round: round("r1", "a", { b: 10, c: 10 }) },
      { type: "addRound", round: round("r2", "a", { b: 5, c: 5 }) },
    );
    expect(computeStandings(match).find((s) => s.player.id === "a")?.roundsWon).toBe(2);
  });
});

describe("resetMatch", () => {
  it("clears the scores but keeps the roster", () => {
    const match = apply(
      emptyMatch(),
      { type: "addRound", round: round("r1", "b", { a: 42, c: 25 }) },
      { type: "resetMatch", matchId: "m2", at: 1 },
    );
    expect(match.rounds).toHaveLength(0);
    expect(match.adjustments).toHaveLength(0);
    expect(match.players).toHaveLength(3);
  });
});
