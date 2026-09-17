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
    alarmRepeats: 1,
    bypassSilentSwitch: true,
    cues: Object.freeze({
      tick: Object.freeze({
        kind: "synth",
        preset: "marimba",
        waveform: "sine",
        freqHz: 880,
        volume: 0.55,
        pulses: Object.freeze({ count: 1, interval: 0 }),
        // 3s -> 698.5Hz, 2s -> 784Hz, 1s -> 880Hz. Rising = running out.
        //
        // The ladder's length caps warnAtSeconds (see MAX_WARN_SECONDS), and
        // that cap is load-bearing: past the end of the ladder every cue lands
        // on the same pitch, and a row of identical pitches a second apart is
        // a ticking clock, not a count-in. Three rising tones, then the alarm
        // — that is the whole of the sound this app makes.
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

/**
 * The count-in is the pitch ladder, so it can never be longer than the ladder.
 * See the comment on the cue above.
 */
export const MAX_WARN_SECONDS =
  DEFAULT_SETTINGS.sound.cues.tick.ladder?.length ?? 3;
