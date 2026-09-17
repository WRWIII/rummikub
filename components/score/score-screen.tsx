"use client";

import { useState } from "react";
import { StandingsTable } from "./standings-table";
import { RoundEntrySheet } from "./round-entry-sheet";
import { RoundHistory } from "./round-history";
import { RosterEditor } from "./roster-editor";
import { AdjustTotalDialog } from "./adjust-total-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/sheet";
import { PlusIcon, UndoIcon } from "@/components/ui/icons";
import { computeStandings } from "@/lib/match/compute";
import { canUndo, resetMatch, undo } from "@/lib/match/store";
import { useMatchState } from "@/lib/match/use-match";
import type { Round, Standing } from "@/lib/match/types";

export function ScoreScreen() {
  const state = useMatchState();
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingRound, setEditingRound] = useState<Round | null>(null);
  const [adjusting, setAdjusting] = useState<Standing | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // The store hasn't hydrated yet — this only ever shows for the instant
  // between HTML parse and hydration. A prerendered table of zeros would read
  // as "my match got wiped", which is much worse than a skeleton.
  if (state.status === "unloaded") return <Skeleton />;

  const { match } = state;
  const standings = computeStandings(match);
  const hasPlayers = match.players.some((p) => p.active);

  const openNewRound = () => {
    setEditingRound(null);
    setEntryOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-lg">
      {standings.length > 0 && (
        <>
          <h1 className="mb-3 text-2xl font-bold text-tile-face">
            Standings
          </h1>
          <StandingsTable standings={standings} onPickPlayer={setAdjusting} />
        </>
      )}

      <div className="mt-4 flex gap-2">
        <Button
          variant="primary"
          className="flex-1"
          onClick={openNewRound}
          disabled={!hasPlayers}
        >
          <PlusIcon className="h-5 w-5" />
          New round
        </Button>
        <Button
          variant="secondary"
          onClick={undo}
          disabled={!canUndo()}
          aria-label="Undo the last change"
        >
          <UndoIcon className="h-5 w-5" />
          Undo
        </Button>
      </div>

      {match.rounds.length > 0 || match.adjustments.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-tile-face/45">
            History
          </h2>
          <RoundHistory
            match={match}
            onEditRound={(round) => {
              setEditingRound(round);
              setEntryOpen(true);
            }}
          />
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-tile-face/45">
          Players
        </h2>
        <RosterEditor match={match} />
      </section>

      {(match.rounds.length > 0 || match.adjustments.length > 0) && (
        <div className="mt-8">
          <Button
            variant="ghost"
            className="w-full text-ink-orange"
            onClick={() => setConfirmReset(true)}
          >
            Start a new match
          </Button>
        </div>
      )}

      {/* Mounted only while open and keyed on the round, so the draft state
          seeds itself from props and resets on every open. */}
      {entryOpen && (
        <RoundEntrySheet
          key={editingRound?.id ?? "new"}
          players={match.players}
          editing={editingRound}
          onClose={() => {
            setEntryOpen(false);
            setEditingRound(null);
          }}
        />
      )}

      {adjusting && (
        <AdjustTotalDialog
          key={adjusting.player.id}
          standing={adjusting}
          onClose={() => setAdjusting(null)}
        />
      )}

      <ConfirmDialog
        open={confirmReset}
        title="Start a new match?"
        body="This clears every round and correction. Your players stay. You can undo it straight afterwards if it was a mistake."
        confirmLabel="Clear the scores"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetMatch();
          setConfirmReset(false);
        }}
      />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto w-full max-w-lg animate-pulse" aria-hidden>
      <div className="mb-3 h-8 w-40 rounded-lg bg-white/10" />
      <div className="space-y-px overflow-hidden rounded-2xl bg-white/7">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 bg-white/3" />
        ))}
      </div>
    </div>
  );
}
