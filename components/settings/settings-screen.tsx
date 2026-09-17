"use client";

import { TimerSettings } from "./timer-settings";
import { SoundSettings } from "./sound-settings";
import { DataSettings } from "./data-settings";
import { DiagnosticsPanel } from "./diagnostics-panel";
import { RosterEditor } from "@/components/score/roster-editor";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/fields";
import { useUpdateAvailable } from "@/components/service-worker-manager";
import { useMatchState } from "@/lib/match/use-match";

export function SettingsScreen() {
  const update = useUpdateAvailable();
  const match = useMatchState();

  return (
    <div className="mx-auto w-full max-w-lg">
      <h1 className="mb-5 text-2xl font-bold text-tile-face">
        Settings
      </h1>

      {/* Deliberately here and not over the tap surface: swapping the bundle
          under a running timer would be worse than waiting. */}
      {update.ready && update.apply && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl bg-ink-blue/25 px-4 py-3">
          <span className="text-sm text-tile-face">
            A new version is ready.
          </span>
          <Button variant="primary" className="min-h-10 px-3 text-sm" onClick={update.apply}>
            Reload
          </Button>
        </div>
      )}

      <TimerSettings />
      <SoundSettings />

      {/* The same roster component the scoring screen uses — one player list,
          one source of truth. */}
      <Section title="Players">
        <div className="px-4 py-3">
          {match.status === "ready" ? (
            <RosterEditor match={match.match} />
          ) : (
            <div className="h-24 animate-pulse rounded-xl bg-white/4" aria-hidden />
          )}
        </div>
      </Section>

      <DataSettings />
      <DiagnosticsPanel />
    </div>
  );
}
