"use client";

import { createStore } from "@/lib/store/create-store";
import {
  STORAGE_KEYS,
  createDebouncedWriter,
  readEnvelope,
  subscribeToKey,
} from "@/lib/persist/local-storage";
import { PRESETS, type PresetId } from "@/lib/audio/presets";
import { DEFAULT_SETTINGS, MAX_SECONDS, MIN_SECONDS } from "./defaults";
import type { CueId, Settings, SoundSource } from "./types";

const VERSION = 1;

/** OscillatorType minus "custom", which needs a PeriodicWave we never build. */
export const WAVEFORMS = ["sine", "square", "sawtooth", "triangle"] as const;

/* -------------------------------------------------------------------------
   Migration / validation.

   Anything read back from storage is untrusted: it may be from an older build,
   hand-edited, or half-written. Coerce field by field rather than trusting the
   shape, so a single bad value can't leave the app with an unusable timer.
------------------------------------------------------------------------- */

function clamp(n: number, lo: number, hi: number): number {
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}

function coerceCue(raw: unknown, fallback: SoundSource): SoundSource {
  if (typeof raw !== "object" || raw === null) return fallback;
  const r = raw as Record<string, unknown>;

  const pulses = {
    count: clamp(Number((r.pulses as Record<string, unknown>)?.count ?? 1), 1, 12),
    interval: clamp(
      Number((r.pulses as Record<string, unknown>)?.interval ?? 0),
      0,
      2,
    ),
  };
  const volume = clamp(Number(r.volume ?? 0.7), 0, 1);
  const ladder = Array.isArray(r.ladder)
    ? r.ladder.filter((n): n is number => typeof n === "number")
    : undefined;

  if (r.kind === "sample" && typeof r.assetId === "string") {
    return {
      kind: "sample",
      assetId: r.assetId,
      fileName: typeof r.fileName === "string" ? r.fileName : "Custom sound",
      volume,
      pulses,
      ladder,
    };
  }

  const preset = (
    typeof r.preset === "string" && r.preset in PRESETS ? r.preset : "beep"
  ) as PresetId;

  return {
    kind: "synth",
    preset,
    waveform: WAVEFORMS.includes(r.waveform as (typeof WAVEFORMS)[number])
      ? (r.waveform as OscillatorType)
      : PRESETS[preset].partials[0].type,
    freqHz: clamp(Number(r.freqHz ?? PRESETS[preset].baseFreq), 80, 4000),
    volume,
    pulses,
    ladder,
  };
}

export function migrateSettings(raw: unknown): Settings {
  if (typeof raw !== "object" || raw === null) return DEFAULT_SETTINGS;
  const r = raw as Record<string, unknown>;
  const timer = (r.timer ?? {}) as Record<string, unknown>;
  const sound = (r.sound ?? {}) as Record<string, unknown>;
  const cues = (sound.cues ?? {}) as Record<string, unknown>;

  return {
    v: 1,
    timer: {
      maxSeconds: Math.round(
        clamp(
          Number(timer.maxSeconds ?? DEFAULT_SETTINGS.timer.maxSeconds),
          MIN_SECONDS,
          MAX_SECONDS,
        ),
      ),
      presetSeconds: Array.isArray(timer.presetSeconds)
        ? timer.presetSeconds.filter(
            (n): n is number => typeof n === "number" && n > 0,
          )
        : [...DEFAULT_SETTINGS.timer.presetSeconds],
      warnAtSeconds: Math.round(clamp(Number(timer.warnAtSeconds ?? 3), 0, 10)),
      keepAwake: timer.keepAwake !== false,
      haptics: timer.haptics !== false,
    },
    sound: {
      muted: sound.muted === true,
      masterVolume: clamp(Number(sound.masterVolume ?? 0.8), 0, 1),
      bypassSilentSwitch: sound.bypassSilentSwitch !== false,
      cues: {
        tick: coerceCue(cues.tick, DEFAULT_SETTINGS.sound.cues.tick),
        alarm: coerceCue(cues.alarm, DEFAULT_SETTINGS.sound.cues.alarm),
      },
    },
  };
}

/* -------------------------------------------------------------------------
   Store.

   Hydrates synchronously at module scope — before the first client render, so
   the only render that ever sees defaults is the build-time prerender baked
   into the HTML. No post-hydration useEffect swap, no second render pass, no
   flash of the wrong turn length.
------------------------------------------------------------------------- */

function loadInitial(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const envelope = readEnvelope(STORAGE_KEYS.settings);
  if (!envelope) return DEFAULT_SETTINGS;
  return migrateSettings(envelope.data);
}

export const settingsStore = createStore<Settings>(loadInitial());
export const SETTINGS_SERVER_SNAPSHOT = DEFAULT_SETTINGS;

const write = createDebouncedWriter<Settings>(STORAGE_KEYS.settings, VERSION);
settingsStore.subscribe(() => write(settingsStore.get()));

if (typeof window !== "undefined") {
  subscribeToKey(STORAGE_KEYS.settings, (envelope) => {
    if (envelope) settingsStore.set(migrateSettings(envelope.data));
  });
}

/* ------------------------------- actions ------------------------------- */

export function setMaxSeconds(seconds: number): void {
  const clamped = Math.round(clamp(seconds, MIN_SECONDS, MAX_SECONDS));
  settingsStore.set((prev) => ({
    ...prev,
    timer: { ...prev.timer, maxSeconds: clamped },
  }));
}

export function updateTimerSettings(
  patch: Partial<Settings["timer"]>,
): void {
  settingsStore.set((prev) => ({
    ...prev,
    timer: { ...prev.timer, ...patch },
  }));
}

export function updateSoundSettings(
  patch: Partial<Omit<Settings["sound"], "cues">>,
): void {
  settingsStore.set((prev) => ({
    ...prev,
    sound: { ...prev.sound, ...patch },
  }));
}

export function toggleMuted(): void {
  settingsStore.set((prev) => ({
    ...prev,
    sound: { ...prev.sound, muted: !prev.sound.muted },
  }));
}

export function updateCue(cueId: CueId, next: SoundSource): void {
  settingsStore.set((prev) => ({
    ...prev,
    sound: { ...prev.sound, cues: { ...prev.sound.cues, [cueId]: next } },
  }));
}

export function resetSettings(): void {
  settingsStore.set(migrateSettings(DEFAULT_SETTINGS));
}
