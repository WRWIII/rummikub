"use client";

import { PLAYER_COLORS } from "@/lib/match/store";
import type { Standing } from "@/lib/match/types";

export function StandingsTable({
  standings,
  onPickPlayer,
}: {
  standings: Standing[];
  onPickPlayer: (standing: Standing) => void;
}) {
  const visible = standings.filter((s) => s.player.active || s.roundsWon > 0 || s.total !== 0);

  if (visible.length === 0) return null;

  return (
    <ul className="overflow-hidden rounded-2xl bg-white/7">
      {visible.map((standing) => (
        <li key={standing.player.id}>
          <button
            type="button"
            onClick={() => onPickPlayer(standing)}
            className="flex w-full items-center gap-3 border-b border-white/7 px-4 py-3 text-left last:border-b-0 active:bg-white/10"
          >
            <span className="numerals w-6 shrink-0 text-center text-sm font-bold text-tile-face/40">
              {standing.rank}
            </span>

            {/* A miniature tile, in that player's colour. */}
            <span
              className="tile flex h-9 w-7 shrink-0 items-center justify-center rounded-md text-sm font-bold"
              style={{ color: PLAYER_COLORS[standing.player.colorIndex] }}
              aria-hidden
            >
              {standing.player.name.slice(0, 1).toUpperCase()}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold text-tile-face">
                {standing.player.name}
                {!standing.player.active && (
                  <span className="ml-2 text-xs font-normal text-tile-face/40">
                    retired
                  </span>
                )}
              </span>
              <span className="block text-xs text-tile-face/45">
                {standing.roundsWon} {standing.roundsWon === 1 ? "win" : "wins"}
                {standing.adjustmentTotal !== 0 &&
                  ` · ${standing.adjustmentTotal > 0 ? "+" : ""}${standing.adjustmentTotal} corrected`}
              </span>
            </span>

            <span
              className={`numerals shrink-0 text-2xl font-bold ${
                standing.total > 0
                  ? "text-tile-face"
                  : standing.total < 0
                    ? "text-ink-orange"
                    : "text-tile-face/50"
              }`}
            >
              {standing.total > 0 ? "+" : ""}
              {standing.total}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
