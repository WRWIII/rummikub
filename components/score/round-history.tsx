"use client";

import { roundDeltas } from "@/lib/match/compute";
import { removeAdjustment, removeRound } from "@/lib/match/store";
import type { Match, PlayerId, Round } from "@/lib/match/types";
import { Button } from "@/components/ui/button";

export function RoundHistory({
  match,
  onEditRound,
}: {
  match: Match;
  onEditRound: (round: Round) => void;
}) {
  const nameOf = (id: PlayerId) =>
    match.players.find((p) => p.id === id)?.name ?? "Unknown";

  // Newest first, rounds and corrections interleaved by time.
  const entries = [
    ...match.rounds.map((round) => ({ kind: "round" as const, at: round.at, round })),
    ...match.adjustments.map((adjustment) => ({
      kind: "adjustment" as const,
      at: adjustment.at,
      adjustment,
    })),
  ].sort((a, b) => b.at - a.at);

  if (entries.length === 0) return null;

  return (
    <ul className="space-y-2">
      {entries.map((entry) =>
        entry.kind === "round" ? (
          <li
            key={entry.round.id}
            className="rounded-2xl bg-white/7 px-4 py-3"
          >
            <details>
              <summary className="flex cursor-pointer items-center justify-between gap-3">
                <span className="min-w-0 truncate text-base font-semibold text-tile-face">
                  {nameOf(entry.round.winnerId)} went out
                </span>
                <span className="numerals shrink-0 text-lg font-bold text-tile-face">
                  +{roundDeltas(entry.round)[entry.round.winnerId] ?? 0}
                </span>
              </summary>

              <ul className="mt-3 space-y-1 border-t border-white/10 pt-3">
                {entry.round.participantIds.map((id) => {
                  const delta = roundDeltas(entry.round)[id] ?? 0;
                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="truncate text-tile-face/70">
                        {nameOf(id)}
                      </span>
                      <span
                        className={`numerals font-semibold ${
                          delta >= 0
                            ? "text-tile-face"
                            : "text-ink-orange"
                        }`}
                      >
                        {delta > 0 ? "+" : ""}
                        {delta}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 flex gap-2">
                <Button
                  variant="secondary"
                  className="min-h-10 flex-1 text-sm"
                  onClick={() => onEditRound(entry.round)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-10 flex-1 text-sm"
                  onClick={() => removeRound(entry.round.id)}
                >
                  Delete
                </Button>
              </div>
            </details>
          </li>
        ) : (
          <li
            key={entry.adjustment.id}
            className="flex items-center justify-between gap-3 rounded-2xl bg-white/4 px-4 py-3"
          >
            <span className="min-w-0 truncate text-sm text-tile-face/65">
              Manual correction · {nameOf(entry.adjustment.playerId)}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="numerals font-semibold text-tile-face">
                {entry.adjustment.delta > 0 ? "+" : ""}
                {entry.adjustment.delta}
              </span>
              <Button
                variant="ghost"
                className="min-h-9 px-2 text-xs"
                onClick={() => removeAdjustment(entry.adjustment.id)}
              >
                Undo
              </Button>
            </span>
          </li>
        ),
      )}
    </ul>
  );
}
