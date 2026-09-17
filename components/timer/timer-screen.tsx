"use client";

import Link from "next/link";
import { useCallback, type PointerEvent } from "react";
import { TimerTile, type TileTone } from "./timer-tile";
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

/**
 * One tile on felt, and nothing else.
 *
 * No instructions, no progress bar, no labels: the whole screen is the
 * gesture, so anything drawn beside the tile is just something competing with
 * it. The navigation icons are deliberately faint — they need to be findable,
 * not noticed.
 */
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

      <header className="relative z-10 flex items-center justify-between px-2 pt-1">
        <IconButton
          label={muted ? "Unmute cues" : "Mute cues"}
          onActivate={toggleMuted}
          active={muted}
        >
          {muted ? (
            <SoundOffIcon className="h-[1.15rem] w-[1.15rem]" />
          ) : (
            <SoundOnIcon className="h-[1.15rem] w-[1.15rem]" />
          )}
        </IconButton>

        <div className="flex items-center">
          <IconLink href="/score" label="Scores">
            <ScoreIcon className="h-[1.15rem] w-[1.15rem]" />
          </IconLink>
          <IconLink href="/settings" label="Settings">
            <SettingsIcon className="h-[1.15rem] w-[1.15rem]" />
          </IconLink>
        </div>
      </header>

      {/* -mt-2 pulls the tile back to the optical centre of the screen: the
          header above it has no counterweight below. */}
      <main className="relative z-10 -mt-2 flex flex-1 items-center justify-center">
        <TimerTile
          seconds={timer.displaySeconds}
          tone={tone}
          status={timer.status}
          pulsing={inWarning}
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
    </div>
  );
}

/* --------------------------------------------------------------------------
   Chrome controls.

   Every one of these stops the pointerdown from reaching the tap surface, so
   reaching for settings never resets someone's turn. The hit areas stay at
   44px even though the glyphs are small — this gets used with the phone flat
   on a table, and a faint icon still has to be easy to hit.
-------------------------------------------------------------------------- */

const ICON_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-full transition-colors";

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
      className={`${ICON_BUTTON} ${
        active
          ? "text-ink-red/90"
          : "text-tile-face/30 active:text-tile-face/60"
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
      className={`${ICON_BUTTON} text-tile-face/30 active:text-tile-face/60`}
    >
      {children}
    </Link>
  );
}
