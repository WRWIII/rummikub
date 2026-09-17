"use client";

import { useEffect } from "react";
import {
  installEngine,
  onCue,
  onExpire,
  onRunCancel,
  onRunStart,
  setMaxMs,
  setWarnAtSeconds,
} from "@/lib/timer/engine";
import {
  acquireWakeLock,
  installWakeLockRecovery,
  releaseWakeLock,
} from "@/lib/timer/wake-lock";
import {
  getContext,
  getMaster,
  installAudioRecovery,
  setMasterVolume,
} from "@/lib/audio/engine";
import { cancelHandles, preloadCues, scheduleTurn } from "@/lib/audio/cues";
import type { Handle } from "@/lib/audio/synth";
import { settingsStore } from "@/lib/settings/store";
import { TICK_PATTERN, alarmPattern, vibrate } from "@/lib/util/haptics";

/**
 * Mounted once from the root layout, so it survives every navigation. Renders
 * nothing — it exists to keep the timer, audio and wake lock alive
 * independently of which screen is showing.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    installEngine();
    installAudioRecovery();
    installWakeLockRecovery();

    let scheduled: Handle[] = [];

    const applySettings = () => {
      const settings = settingsStore.get();
      setMaxMs(settings.timer.maxSeconds * 1000);
      setWarnAtSeconds(settings.timer.warnAtSeconds);
      setMasterVolume(settings.sound.muted ? 0 : settings.sound.masterVolume);

      const ctx = getContext();
      if (ctx) void preloadCues(ctx, settings);
    };

    applySettings();
    const unsubscribeSettings = settingsStore.subscribe(applySettings);

    const unsubscribeStart = onRunStart((run) => {
      const settings = settingsStore.get();
      const ctx = getContext();
      const master = getMaster();

      // The tap handler calls unlockAudio() before poke(), so by here the
      // context exists and is resuming. If it doesn't, the run is silent but
      // otherwise fine — the next tap creates it.
      if (ctx && master) {
        cancelHandles(scheduled);
        const remaining = (run.deadlineAt - Date.now()) / 1000;
        scheduled = scheduleTurn(ctx, master, remaining, settings);
      }

      if (settings.timer.keepAwake) void acquireWakeLock();
    });

    const unsubscribeCancel = onRunCancel(() => {
      cancelHandles(scheduled);
      scheduled = [];
    });

    const unsubscribeCue = onCue(() => {
      if (settingsStore.get().timer.haptics) vibrate(TICK_PATTERN);
    });

    const unsubscribeExpire = onExpire(() => {
      const settings = settingsStore.get();
      if (settings.timer.haptics) {
        vibrate(alarmPattern(settings.sound.alarmRepeats));
      }
      // Don't hold the screen on all evening once the turn is over.
      void releaseWakeLock();
    });

    return () => {
      unsubscribeSettings();
      unsubscribeStart();
      unsubscribeCancel();
      unsubscribeCue();
      unsubscribeExpire();
      cancelHandles(scheduled);
    };
  }, []);

  return <>{children}</>;
}
