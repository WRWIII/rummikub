"use client";

import Link from "next/link";
import { useCallback, type PointerEvent } from "react";
import { TimerTile, type TileTone } from "./timer-tile";
import { DrainBar } from "./drain-bar";
import { useTimerSnapshot } from "@/lib/timer/use-timer";
import { poke } from "@/lib/timer/engine";
import { unlockAudio } from "@/lib/audio/engine";
import { settingsStore, toggleMuted } from "@/lib/settings/store";
import { SETTINGS_SERVER_SNAPSHOT } from "@/lib/settings/store";
import { useStore } from "@/lib/store/use-store";
import {
  ScoreIcon,
  SettingsIcon,
  SoundOffIcon,
  SoundOnIcon,
} from "@/components/ui/icons";

/** Below this the numeral goes orange — "you're running out". */
const CLOSE_SECONDS = 10;

export function TimerScreen() {
  const timer = useTimerSnapshot();
  const muted = useStore(
    settingsStore,
    (s) => s.sound.muted,
    SETTINGS_SERVER_SNAPSHOT,
  );
  const warnAt = useStore(
    settingsStore,
    (s) => s.timer.warnAtSeconds,
    SETTINGS_SERVER_SNAPSHOT,
  );

  /**
   * The gesture. unlockAudio() must run synchronously here, before anything
   * else and before any await, or iOS silently refuses to play — the resume()
   * has to sit in the call chain rooted at the gesture.
   */
  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      // A touch can produce several pointerdown events; only the primary one
      // is the tap. Never pair this with onClick, or one tap fires twice.
      if (!event.isPrimary) return;
      const settings = settingsStore.get();
      unlockAudio(settings.sound.bypassSilentSwitch);
      poke();
    },
    [],
  );

  const inWarning = timer.status === "running" && timer.displaySeconds <= warnAt;

  const tone: TileTone =
    timer.status === "expired" || inWarning
      ? "red"
      : timer.status === "idle"
        ? "black"
        : timer.displaySeconds <= CLOSE_SECONDS
          ? "orange"
          : "blue";

  return (
    <div
      className="stage felt relative flex touch-none flex-col overflow-hidden"
      onPointerDown={handlePointerDown}
      role="button"
      tabIndex={0}
      aria-label="Turn timer. Tap anywhere to reset."
    >
      {timer.status === "expired" && (
        <div
          aria-hidden
          className="alarm-flash pointer-events-none absolute inset-0 bg-ink-red"
        />
      )}

      <header className="relative z-10 flex items-center justify-between px-4 pt-3">
        <IconButton
          label={muted ? "Unmute cues" : "Mute cues"}
          onActivate={toggleMuted}
          active={muted}
        >
          {muted ? (
            <SoundOffIcon className="h-6 w-6" />
          ) : (
            <SoundOnIcon className="h-6 w-6" />
          )}
        </IconButton>

        <div className="flex items-center gap-1">
          <IconLink href="/score" label="Scores">
            <ScoreIcon className="h-6 w-6" />
          </IconLink>
          <IconLink href="/settings" label="Settings">
            <SettingsIcon className="h-6 w-6" />
          </IconLink>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6">
        <TimerTile
          seconds={timer.displaySeconds}
          tone={tone}
          status={timer.status}
          pulsing={inWarning}
        />

        <DrainBar
          status={timer.status}
          startedAt={timer.startedAt}
          maxMs={timer.maxMs}
          runId={timer.runId}
        />

        {/* Screen-reader announcement, throttled to the cue window so it
            doesn't read out all sixty seconds. */}
        <span className="sr-only" aria-live="polite">
          {timer.status === "expired"
            ? "Time is up"
            : inWarning
              ? `${timer.displaySeconds} seconds left`
              : ""}
        </span>
      </main>

      <footer className="relative z-10 pb-6 text-center">
        <p className="text-sm font-medium tracking-wide text-tile-face/55">
          {timer.status === "idle"
            ? "Tap anywhere to start"
            : timer.status === "expired"
              ? "Time — tap for the next turn"
              : "Tap anywhere for the next turn"}
        </p>
      </footer>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Chrome controls.

   Every one of these stops the pointerdown from reaching the tap surface, so
   reaching for settings never resets someone's turn. 48px hit areas because
   this gets used with the phone flat on a table.
-------------------------------------------------------------------------- */

function IconButton({
  label,
  onActivate,
  active,
  children,
}: {
  label: string;
  onActivate: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (!event.isPrimary) return;
        onActivate();
      }}
      className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
        active
          ? "bg-ink-red/85 text-tile-face"
          : "text-tile-face/70 active:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      onPointerDown={(event) => event.stopPropagation()}
      className="flex h-12 w-12 items-center justify-center rounded-full text-tile-face/70 active:bg-white/10"
    >
      {children}
    </Link>
  );
}
