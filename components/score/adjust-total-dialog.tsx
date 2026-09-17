"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { setPlayerTotal } from "@/lib/match/store";
import type { Standing } from "@/lib/match/types";

/**
 * Hand-correcting a total never rewrites a round — it appends a correction, so
 * totals stay a pure fold over rounds plus corrections, and the change shows up
 * in history where everyone can see it.
 *
 * Fixing an actual data-entry mistake is a different operation: edit the round
 * from the history list, which re-derives both the loser's negative and the
 * winner's positive together.
 */
export function AdjustTotalDialog({
  standing,
  onClose,
}: {
  standing: Standing;
  onClose: () => void;
}) {
  // The parent keys this on the player, so opening it for someone else
  // remounts and re-seeds rather than syncing props into state via an effect.
  const [value, setValue] = useState(() => String(standing.total));

  const parsed = value === "" || value === "-" ? Number.NaN : Number(value);
  const valid = Number.isInteger(parsed);
  const delta = valid ? parsed - standing.total : 0;

  return (
    <Sheet open title={`Correct ${standing.player.name}'s total`} onClose={onClose}>
      <p className="mb-4 text-sm leading-relaxed text-tile-face/60">
        This records a correction rather than changing a round. If a tile value was
        typed wrong, edit that round instead — the winner&rsquo;s score updates with it.
      </p>

      <label className="mb-2 block text-sm font-semibold text-tile-face/70">
        New total
      </label>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`New total for ${standing.player.name}`}
        value={value}
        onChange={(event) =>
          setValue(event.target.value.replace(/[^0-9-]/g, "").replace(/(?!^)-/g, ""))
        }
        className="numerals h-14 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-center text-2xl font-bold text-tile-face"
      />

      <p className="mt-3 text-center text-sm text-tile-face/55">
        {valid && delta !== 0
          ? `Records a correction of ${delta > 0 ? "+" : ""}${delta}`
          : "No change"}
      </p>

      <div className="mt-6 flex gap-2">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          disabled={!valid || delta === 0}
          onClick={() => {
            setPlayerTotal(standing.player.id, parsed);
            onClose();
          }}
        >
          Save correction
        </Button>
      </div>
    </Sheet>
  );
}
