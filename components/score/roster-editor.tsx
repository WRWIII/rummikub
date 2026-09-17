"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/fields";
import { PlusIcon } from "@/components/ui/icons";
import { canHardDelete } from "@/lib/match/compute";
import {
  PLAYER_COLORS,
  addPlayer,
  removePlayer,
  renamePlayer,
  restorePlayer,
  retirePlayer,
} from "@/lib/match/store";
import type { Match } from "@/lib/match/types";

/**
 * The single roster. Rendered by both the scoring screen and settings — one
 * component, one source of truth in Match.players. A second player list in
 * settings would immediately drift out of sync with the rounds.
 */
export function RosterEditor({ match }: { match: Match }) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const submit = () => {
    const name = draft.trim();
    if (!name) return;
    addPlayer(name);
    setDraft("");
  };

  const commitRename = () => {
    if (editingId) renamePlayer(editingId, editingName);
    setEditingId(null);
  };

  return (
    <div>
      <ul className="mb-3 space-y-2">
        {match.players.map((player) => {
          const deletable = canHardDelete(match, player.id);
          const isEditing = editingId === player.id;

          return (
            <li
              key={player.id}
              className="flex items-center gap-3 rounded-2xl bg-white/7 px-3 py-2.5"
            >
              <span
                className="tile flex h-10 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold"
                style={{ color: PLAYER_COLORS[player.colorIndex] }}
                aria-hidden
              >
                {player.name.slice(0, 1).toUpperCase()}
              </span>

              {isEditing ? (
                <TextInput
                  label="Player name"
                  value={editingName}
                  onChange={setEditingName}
                  onSubmit={commitRename}
                  className="min-w-0 flex-1"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(player.id);
                    setEditingName(player.name);
                  }}
                  className="min-w-0 flex-1 truncate text-left text-base font-medium text-tile-face"
                >
                  {player.name}
                  {!player.active && (
                    <span className="ml-2 text-xs font-normal text-tile-face/40">
                      retired
                    </span>
                  )}
                </button>
              )}

              {isEditing ? (
                <Button
                  variant="primary"
                  className="min-h-10 px-3 text-sm"
                  onClick={commitRename}
                >
                  Done
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  className="min-h-10 px-3 text-sm"
                  onClick={() => {
                    if (player.active) {
                      // Never hard-delete someone who appears in a round —
                      // that orphans the round and corrupts every total
                      // derived from it. They're retired instead, and keep
                      // their place in the history.
                      if (deletable) removePlayer(player.id);
                      else retirePlayer(player.id);
                    } else {
                      restorePlayer(player.id);
                    }
                  }}
                >
                  {!player.active ? "Restore" : deletable ? "Remove" : "Retire"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <TextInput
          label="New player name"
          placeholder="Add a player"
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          className="min-w-0 flex-1"
        />
        <Button variant="primary" onClick={submit} disabled={!draft.trim()}>
          <PlusIcon className="h-5 w-5" />
          Add
        </Button>
      </div>
    </div>
  );
}
