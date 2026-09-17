"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/fields";
import { PLAYER_COLORS, saveRound } from "@/lib/match/store";
import { validateRound } from "@/lib/match/reducer";
import { SUSPICIOUS_LEFTOVER, type Player, type Round } from "@/lib/match/types";

/**
 * The parent mounts this only while it's open, keyed on the round being
 * edited — so the draft state initialises from props and resets itself on
 * open, with no effect writing state back into the component.
 */
export function RoundEntrySheet({
  players,
  editing,
  onClose,
}: {
  players: Player[];
  editing: Round | null;
  onClose: () => void;
}) {
  const roster = players.filter(
    (p) => p.active || editing?.participantIds.includes(p.id),
  );

  const [winnerId, setWinnerId] = useState<string>(() => editing?.winnerId ?? "");

  const [satOut, setSatOut] = useState<Set<string>>(
    () =>
      new Set(
        editing
          ? roster.filter((p) => !editing.participantIds.includes(p.id)).map((p) => p.id)
          : [],
      ),
  );

  // Drafts are strings and stay local until Save: persisting on every keystroke
  // would jank the input, and a blank field has to stay distinguishable from a
  // real zero.
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    editing
      ? Object.fromEntries(
          Object.entries(editing.leftovers).map(([id, value]) => [id, String(value)]),
        )
      : {},
  );

  const participants = roster.filter((p) => !satOut.has(p.id));
  const losers = participants.filter((p) => p.id !== winnerId);

  const leftovers: Record<string, number> = {};
  for (const player of losers) {
    const raw = drafts[player.id];
    leftovers[player.id] =
      raw === undefined || raw === "" ? Number.NaN : Number(raw);
  }

  const pot = Object.values(leftovers).reduce(
    (sum, value) => sum + (Number.isNaN(value) ? 0 : value),
    0,
  );

  const candidate: Round = {
    id: editing?.id ?? "draft",
    at: editing?.at ?? 0,
    participantIds: participants.map((p) => p.id),
    winnerId,
    leftovers,
  };

  const errors = winnerId ? validateRound(candidate, roster) : [];
  const canSave = Boolean(winnerId) && errors.length === 0;

  const suspicious = losers.filter((p) => {
    const value = leftovers[p.id];
    return !Number.isNaN(value) && value > SUSPICIOUS_LEFTOVER;
  });

  const handleSave = () => {
    if (!canSave) return;
    saveRound(winnerId, candidate.participantIds, leftovers, editing?.id);
    onClose();
  };

  const toggleSatOut = (id: string) => {
    if (id === winnerId) setWinnerId("");
    setSatOut((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Sheet
      open
      title={editing ? "Edit round" : "New round"}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-tile-face/45">
              Winner gets
            </div>
            <div className="numerals text-2xl font-bold text-tile-face">
              {winnerId ? `+${pot}` : "—"}
            </div>
          </div>
          <Button variant="primary" onClick={handleSave} disabled={!canSave}>
            {editing ? "Save changes" : "Save round"}
          </Button>
        </div>
      }
    >
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-tile-face/50">
        Who went out?
      </h3>
      <div className="mb-6 flex flex-wrap gap-2" role="radiogroup" aria-label="Winner">
        {participants.map((player) => {
          const active = player.id === winnerId;
          return (
            <button
              key={player.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setWinnerId(player.id)}
              className={`min-h-12 rounded-xl px-4 text-base font-semibold transition-colors ${
                active
                  ? "bg-tile-face text-felt"
                  : "bg-white/10 text-tile-face/80 active:bg-white/15"
              }`}
            >
              {player.name}
            </button>
          );
        })}
      </div>

      {winnerId && (
        <>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-tile-face/50">
            Tiles left in hand
          </h3>
          <ul className="mb-4 space-y-2">
            {losers.map((player) => (
              <li key={player.id} className="flex items-center gap-3">
                <span
                  className="tile flex h-10 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold"
                  style={{ color: PLAYER_COLORS[player.colorIndex] }}
                  aria-hidden
                >
                  {player.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-base font-medium text-tile-face">
                  {player.name}
                </span>
                <NumberInput
                  label={`Tiles left for ${player.name}`}
                  value={drafts[player.id] ?? ""}
                  placeholder="—"
                  invalid={Number.isNaN(leftovers[player.id])}
                  onChange={(next) =>
                    setDrafts((prev) => ({ ...prev, [player.id]: next }))
                  }
                  className="w-20"
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {errors.length > 0 && winnerId && (
        <p className="mb-3 rounded-xl bg-ink-red/20 px-3 py-2 text-sm text-tile-face">
          {errors[0]}
        </p>
      )}

      {suspicious.length > 0 && (
        <p className="mb-3 rounded-xl bg-ink-orange/20 px-3 py-2 text-sm text-tile-face">
          {suspicious.map((p) => p.name).join(", ")} over {SUSPICIOUS_LEFTOVER} — worth a
          double-check, but save it if that&rsquo;s right.
        </p>
      )}

      <details className="mt-2 rounded-xl bg-white/5 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-tile-face/60">
          Someone sitting out?
        </summary>
        <ul className="mt-3 space-y-2">
          {roster.map((player) => {
            const out = satOut.has(player.id);
            return (
              <li key={player.id} className="flex items-center justify-between gap-3">
                <span className="truncate text-base text-tile-face/85">
                  {player.name}
                </span>
                <Button
                  variant={out ? "secondary" : "ghost"}
                  className="min-h-10 px-3 text-sm"
                  onClick={() => toggleSatOut(player.id)}
                >
                  {out ? "Sitting out" : "Playing"}
                </Button>
              </li>
            );
          })}
        </ul>
      </details>
    </Sheet>
  );
}
