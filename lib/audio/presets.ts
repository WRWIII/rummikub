/**
 * Synth preset recipes.
 *
 * A preset is a timbre: a stack of partials with their own envelopes, plus
 * optional filtering, tremolo and an attack transient. A *cue* (see cues.ts)
 * binds a preset to a pitch, a volume and a pulse pattern.
 *
 * `decay` is seconds to -60dB. It's implemented with setTargetAtTime, whose
 * time constant reaches -60dB at ~6.91 tau — so tau = decay / 6.91 makes these
 * numbers mean literally what they say. Never use
 * exponentialRampToValueAtTime(0, ...) for this: it throws on a zero target.
 */

export type PresetId = "beep" | "chime" | "buzzer" | "marimba";

export interface PartialSpec {
  /** Multiplier on the cue's base frequency. */
  ratio: number;
  /** Relative amplitude, 0..1. */
  gain: number;
  type: OscillatorType;
  /** Seconds to -60dB. */
  decay: number;
  /** Detune in cents — used to make two saws beat against each other. */
  detune?: number;
}

export interface PresetSpec {
  id: PresetId;
  label: string;
  /** Default pitch; the user can override it per cue. */
  baseFreq: number;
  /** Node lifetime in seconds. */
  duration: number;
  attack: number;
  /** Seconds held at peak before the decay starts. */
  hold: number;
  /** Peak gain before the user's volume is applied. */
  peak: number;
  partials: PartialSpec[];
  filter?: { type: BiquadFilterType; freq: number; q: number };
  tremolo?: { rate: number; depth: number; type: OscillatorType };
  /** Mallet/stick transient at the very start of the note. */
  click?: { freq: number; gain: number; duration: number };
}

export const PRESETS: Record<PresetId, PresetSpec> = {
  beep: {
    id: "beep",
    label: "Beep",
    baseFreq: 880,
    duration: 0.14,
    attack: 0.003,
    hold: 0.035,
    peak: 0.9,
    partials: [{ ratio: 1, gain: 1.0, type: "square", decay: 0.1 }],
    filter: { type: "lowpass", freq: 3200, q: 0.7 },
  },

  chime: {
    id: "chime",
    label: "Chime",
    baseFreq: 1046.5,
    duration: 1.8,
    attack: 0.004,
    hold: 0,
    peak: 0.55,
    // Inharmonic tubular-bell ratios. Harmonic ratios would sound like an
    // organ; these are what make it read as a struck bell.
    partials: [
      { ratio: 1.0, gain: 1.0, type: "sine", decay: 1.6 },
      { ratio: 2.0, gain: 0.45, type: "sine", decay: 1.1 },
      { ratio: 2.76, gain: 0.3, type: "sine", decay: 0.8 },
      { ratio: 5.4, gain: 0.12, type: "sine", decay: 0.45 },
    ],
    filter: { type: "highpass", freq: 200, q: 0.5 },
  },

  buzzer: {
    id: "buzzer",
    label: "Buzzer",
    baseFreq: 220,
    duration: 0.45,
    attack: 0.005,
    hold: 0.34,
    peak: 0.75,
    partials: [
      { ratio: 1, gain: 1.0, type: "sawtooth", decay: 0.06 },
      // Detuned twin: the beating between them is most of the "harshness".
      { ratio: 1, gain: 0.55, type: "sawtooth", decay: 0.06, detune: 14 },
      { ratio: 2, gain: 0.25, type: "square", decay: 0.06 },
    ],
    filter: { type: "lowpass", freq: 1400, q: 1.2 },
    tremolo: { rate: 18, depth: 0.55, type: "square" },
  },

  marimba: {
    id: "marimba",
    label: "Marimba",
    baseFreq: 523.25,
    duration: 0.7,
    attack: 0.002,
    hold: 0,
    peak: 0.8,
    // A marimba bar's overtones sit near 1 : 4 : 10.
    partials: [
      { ratio: 1.0, gain: 1.0, type: "sine", decay: 0.55 },
      { ratio: 3.93, gain: 0.32, type: "sine", decay: 0.2 },
      { ratio: 9.2, gain: 0.1, type: "triangle", decay: 0.09 },
    ],
    filter: { type: "lowpass", freq: 6000, q: 0.7 },
    click: { freq: 2600, gain: 0.12, duration: 0.012 },
  },
};

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

/** Seconds-to--60dB converted to a setTargetAtTime time constant. */
export const DECAY_TO_TAU = 6.91;
