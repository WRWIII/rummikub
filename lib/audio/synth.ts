import { DECAY_TO_TAU, type PresetSpec } from "./presets";

export interface Handle {
  cancel(): void;
}

export interface NoteOptions {
  freqHz: number;
  /** Overrides the waveform of the fundamental partial. */
  waveform?: OscillatorType;
  /** 0..1, applied on top of the preset's own peak. */
  volume: number;
}

/**
 * Render one note of a preset, starting at AudioContext time `at`.
 *
 * Envelopes use setTargetAtTime rather than exponentialRampToValueAtTime,
 * which throws on a zero target. setTargetAtTime reaches -60dB at ~6.91 time
 * constants, so tau = decay / 6.91 makes the preset's `decay` field mean
 * exactly what it says.
 */
export function playNote(
  ctx: AudioContext,
  dest: AudioNode,
  spec: PresetSpec,
  opts: NoteOptions,
  at: number,
): Handle {
  const start = Math.max(at, ctx.currentTime);
  const stop = start + spec.duration;

  const nodes: AudioScheduledSourceNode[] = [];
  const disposables: AudioNode[] = [];

  // Per-cue gain: the user's volume, plus a tremolo target if the preset has
  // one. Everything downstream of here is shared.
  const cueGain = ctx.createGain();
  const depth = spec.tremolo?.depth ?? 0;
  cueGain.gain.value = opts.volume * (1 - depth / 2);
  disposables.push(cueGain);

  let tail: AudioNode = cueGain;

  if (spec.filter) {
    const filter = ctx.createBiquadFilter();
    filter.type = spec.filter.type;
    filter.frequency.value = spec.filter.freq;
    filter.Q.value = spec.filter.q;
    filter.connect(cueGain);
    disposables.push(filter);
    tail = filter;
  }

  cueGain.connect(dest);

  if (spec.tremolo) {
    const lfo = ctx.createOscillator();
    lfo.type = spec.tremolo.type;
    lfo.frequency.value = spec.tremolo.rate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = depth / 2;
    lfo.connect(lfoGain);
    lfoGain.connect(cueGain.gain);
    lfo.start(start);
    lfo.stop(stop);
    nodes.push(lfo);
    disposables.push(lfoGain);
  }

  spec.partials.forEach((partial, index) => {
    const osc = ctx.createOscillator();
    osc.type = index === 0 && opts.waveform ? opts.waveform : partial.type;
    osc.frequency.value = opts.freqHz * partial.ratio;
    if (partial.detune) osc.detune.value = partial.detune;

    const gain = ctx.createGain();
    const peak = spec.peak * partial.gain;

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + spec.attack);
    gain.gain.setTargetAtTime(
      0,
      start + spec.attack + spec.hold,
      Math.max(partial.decay / DECAY_TO_TAU, 0.001),
    );

    osc.connect(gain);
    gain.connect(tail);
    osc.start(start);
    osc.stop(stop);

    nodes.push(osc);
    disposables.push(gain);
  });

  // Mallet transient — a very short noise-ish blip that gives a struck
  // instrument its attack.
  if (spec.click) {
    const click = ctx.createOscillator();
    click.type = "triangle";
    click.frequency.value = spec.click.freq;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(spec.click.gain, start);
    clickGain.gain.setTargetAtTime(0, start, spec.click.duration / DECAY_TO_TAU);
    click.connect(clickGain);
    clickGain.connect(tail);
    click.start(start);
    click.stop(start + spec.click.duration * 4);
    nodes.push(click);
    disposables.push(clickGain);
  }

  let done = false;
  const dispose = () => {
    if (done) return;
    done = true;
    for (const node of disposables) {
      try {
        node.disconnect();
      } catch {
        /* already gone */
      }
    }
  };

  // Let the graph be collected once the longest node finishes.
  const last = nodes[nodes.length - 1];
  if (last) last.onended = dispose;

  return {
    cancel() {
      for (const node of nodes) {
        try {
          node.onended = null;
          node.stop(0);
        } catch {
          /* already stopped or never started */
        }
      }
      dispose();
    },
  };
}

/** Same envelope treatment, for a decoded user-supplied file. */
export function playBuffer(
  ctx: AudioContext,
  dest: AudioNode,
  buffer: AudioBuffer,
  volume: number,
  at: number,
  detuneCents = 0,
): Handle {
  const start = Math.max(at, ctx.currentTime);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  if (detuneCents !== 0) {
    source.playbackRate.value = Math.pow(2, detuneCents / 1200);
  }

  const gain = ctx.createGain();
  gain.gain.value = volume;

  source.connect(gain);
  gain.connect(dest);
  source.start(start);

  let done = false;
  const dispose = () => {
    if (done) return;
    done = true;
    try {
      gain.disconnect();
    } catch {
      /* ignore */
    }
  };
  source.onended = dispose;

  return {
    cancel() {
      try {
        source.onended = null;
        source.stop(0);
      } catch {
        /* ignore */
      }
      dispose();
    },
  };
}
