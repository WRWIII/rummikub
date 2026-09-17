import type { Settings } from "./types";

/**
 * Frozen module constant. This doubles as the useSyncExternalStore server
 * snapshot, so it must be a stable reference — React compares identity, and a
 * fresh object per call triggers the cached-snapshot infinite-loop error.
 */
export const DEFAULT_SETTINGS: Settings = Object.freeze({
  v: 1,
  timer: Object.freeze({
    maxSeconds: 60,
    presetSeconds: Object.freeze([30, 45, 60, 90, 120]) as unknown as number[],
    warnAtSeconds: 3,
    keepAwake: true,
    haptics: true,
  }),
  sound: Object.freeze({
    muted: false,
    masterVolume: 0.8,
    bypassSilentSwitch: true,
    cues: Object.freeze({
      tick: Object.freeze({
        kind: "synth",
        preset: "beep",
        waveform: "square",
        freqHz: 880,
        volume: 0.5,
        pulses: Object.freeze({ count: 1, interval: 0 }),
        // 3s -> 698.5Hz, 2s -> 784Hz, 1s -> 880Hz. Rising = running out.
        ladder: Object.freeze([-4, -2, 0]) as unknown as number[],
      }),
      alarm: Object.freeze({
        kind: "synth",
        preset: "buzzer",
        waveform: "sawtooth",
        freqHz: 220,
        volume: 0.95,
        pulses: Object.freeze({ count: 4, interval: 0.22 }),
      }),
    }),
  }),
}) as Settings;

export const MIN_SECONDS = 5;
export const MAX_SECONDS = 600;
