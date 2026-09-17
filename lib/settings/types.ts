import type { PresetId } from "@/lib/audio/presets";

export type CueId = "tick" | "alarm";

/** How many times a cue fires, and how far apart. */
export interface PulsePattern {
  count: number;
  /** Seconds between pulse onsets. */
  interval: number;
}

export type SoundSource =
  | {
      kind: "synth";
      preset: PresetId;
      /** Overrides the preset's own waveform on the fundamental partial. */
      waveform: OscillatorType;
      freqHz: number;
      volume: number;
      pulses: PulsePattern;
      /**
       * Semitone offsets applied per repetition of the cue across a turn.
       * The tick cue uses [-4, -2, 0] so 3-2-1 rises — that's what makes it
       * read as a countdown rather than three identical clicks.
       */
      ladder?: number[];
    }
  | {
      kind: "sample";
      /** Key into the IndexedDB `sounds` store. */
      assetId: string;
      fileName: string;
      volume: number;
      pulses: PulsePattern;
      ladder?: number[];
    };

export interface TimerSettings {
  maxSeconds: number;
  presetSeconds: number[];
  /** Cue the final N seconds. Default 3. */
  warnAtSeconds: number;
  keepAwake: boolean;
  haptics: boolean;
}

/**
 * How many times the time-up alarm fires. Once is the polite default; three is
 * for a noisy table where one burst gets talked over.
 */
export const ALARM_REPEAT_CHOICES = [1, 3] as const;
export type AlarmRepeats = (typeof ALARM_REPEAT_CHOICES)[number];

export interface SoundSettings {
  muted: boolean;
  masterVolume: number;
  alarmRepeats: AlarmRepeats;
  /**
   * Claim the iOS `playback` audio session so the alarm is audible with the
   * ring/silent switch flipped. The cost is real and must be surfaced in the
   * UI: it pauses whatever the user was playing and shows lock-screen
   * transport controls. There is no quieter way past the mute switch.
   */
  bypassSilentSwitch: boolean;
  cues: Record<CueId, SoundSource>;
}

export interface Settings {
  v: 1;
  timer: TimerSettings;
  sound: SoundSettings;
}
