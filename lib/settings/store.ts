"use client";

import { createStore } from "@/lib/store/create-store";
import {
  STORAGE_KEYS,
  createDebouncedWriter,
  readEnvelope,
  subscribeToKey,
} from "@/lib/persist/local-storage";
import { PRESETS, type PresetId } from "@/lib/audio/presets";
import {
  DEFAULT_SETTINGS,
  MAX_SECONDS,
  MAX_WARN_SECONDS,
  MIN_SECONDS,
} from "./defaults";
import {
  ALARM_REPEAT_CHOICES,
  type AlarmRepeats,
  type CueId,
  type PulsePattern,
  type Settings,
  type SoundSource,
} from "./types";

/**
 * 2: the count-in became three rising tones with a hard cap at the ladder
 *    length. v1 allowed up to ten seconds of count-in on a three-step ladder,
 *    which played the same clicky square-wave beep once a second — a ticking
 *    clock. v1 cue overrides are therefore dropped rather than carried
 *    forward; the turn length and the rest of the settings survive.
 */
const VERSION = 2;

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

/**
 * `pulses` exists to build a burst out of a synth blip — the buzzer's four
 * pulses 0.22s apart are what make it go bzzt-bzzt-bzzt-bzzt. A file the user
 * uploaded is already a finished sound, so firing it four times just plays
 * four overlapping copies, and there is no UI to turn that off.
 *
 * So: a sample is always exactly one firing. How many times the alarm sounds
 * is the alarmRepeats setting's job, and only that setting's job.
 */
const SAMPLE_PULSES: PulsePattern = { count: 1, interval: 0 };

/** Applied on every write and every read, so no path can reintroduce it. */
function normaliseCue(cue: SoundSource): SoundSource {
  return cue.kind === "sample" ? { ...cue, pulses: { ...SAMPLE_PULSES } } : cue;
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
    // Anyone who uploaded a file before this invariant existed has a stored
    // pulse count of 4 inherited from the buzzer. Normalising on read fixes
    // them in place, with no version bump needed.
    return normaliseCue({
      kind: "sample",
      assetId: r.assetId,
      fileName: typeof r.fileName === "string" ? r.fileName : "Custom sound",
      volume,
      pulses,
      ladder,
    });
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

export function migrateSettings(raw: unknown, storedVersion = VERSION): Settings {
  if (typeof raw !== "object" || raw === null) return DEFAULT_SETTINGS;
  const r = raw as Record<string, unknown>;
  const timer = (r.timer ?? {}) as Record<string, unknown>;
  const sound = (r.sound ?? {}) as Record<string, unknown>;
  // v1 cues are deliberately discarded — see the note on VERSION.
  const cues = (storedVersion >= 2 ? (sound.cues ?? {}) : {}) as Record<
    string,
    unknown
  >;

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
      warnAtSeconds: Math.round(
        clamp(
          Number(timer.warnAtSeconds ?? DEFAULT_SETTINGS.timer.warnAtSeconds),
          0,
          MAX_WARN_SECONDS,
        ),
      ),
      keepAwake: timer.keepAwake !== false,
      haptics: timer.haptics !== false,
    },
    sound: {
      muted: sound.muted === true,
      masterVolume: clamp(Number(sound.masterVolume ?? 0.8), 0, 1),
      // A fixed set, not a range: anything not on the list falls back to the
      // default rather than being clamped into a value nothing can produce.
      alarmRepeats: ALARM_REPEAT_CHOICES.includes(
        Number(sound.alarmRepeats) as AlarmRepeats,
      )
        ? (Number(sound.alarmRepeats) as AlarmRepeats)
        : DEFAULT_SETTINGS.sound.alarmRepeats,
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
  return migrateSettings(envelope.data, envelope.v);
}

export const settingsStore = createStore<Settings>(loadInitial());
export const SETTINGS_SERVER_SNAPSHOT = DEFAULT_SETTINGS;

const write = createDebouncedWriter<Settings>(STORAGE_KEYS.settings, VERSION);
settingsStore.subscribe(() => write(settingsStore.get()));

if (typeof window !== "undefined") {
  subscribeToKey(STORAGE_KEYS.settings, (envelope) => {
    if (envelope) settingsStore.set(migrateSettings(envelope.data, envelope.v));
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
  const cue = normaliseCue(next);
  settingsStore.set((prev) => ({
    ...prev,
    sound: { ...prev.sound, cues: { ...prev.sound.cues, [cueId]: cue } },
  }));
}

export function resetSettings(): void {
  settingsStore.set(migrateSettings(DEFAULT_SETTINGS));
}
