import { PRESETS } from "./presets";
import { playBuffer, playNote, type Handle } from "./synth";
import { getCachedBuffer, loadSound } from "./samples";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import type { CueId, Settings, SoundSource } from "@/lib/settings/types";

/** Small offset so we never try to schedule in the past. */
const LEAD_TIME = 0.05;

/**
 * Silence between repeats of the alarm. Without a real gap three bursts run
 * into each other and read as one long buzz instead of three.
 */
const ALARM_REST = 0.3;

/**
 * How long one firing of a cue lasts: the last pulse's onset plus however long
 * that pulse rings for. Measured rather than hardcoded so a custom preset or
 * an uploaded file spaces its repeats correctly too.
 */
function cueSpanSeconds(cue: SoundSource): number {
  const tail =
    cue.kind === "sample"
      ? // The buffer isn't decoded yet on the very first turn; half a second
        // is a safe stand-in, and every later turn measures it properly.
        (getCachedBuffer(cue.assetId)?.duration ?? 0.5)
      : PRESETS[cue.preset].duration;
  return (cue.pulses.count - 1) * cue.pulses.interval + tail;
}

/**
 * Schedule the time-up alarm `repeats` times from `at`, and hand back every
 * handle so a tap can silence the lot.
 */
export function scheduleAlarm(
  ctx: AudioContext,
  dest: AudioNode,
  cue: SoundSource,
  at: number,
  repeats: number,
): Handle[] {
  const step = cueSpanSeconds(cue) + ALARM_REST;
  const handles: Handle[] = [];
  for (let i = 0; i < repeats; i++) {
    handles.push(...playCue(ctx, dest, cue, at + i * step, 0));
  }
  return handles;
}

function semitonesToRatio(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

/**
 * Play one cue at AudioContext time `at`.
 *
 * `repetition` indexes into the cue's ladder — the tick cue uses [-4, -2, 0]
 * so the 3/2/1 cues rise in pitch. That's what makes three beeps read as a
 * countdown rather than three identical clicks.
 */
export function playCue(
  ctx: AudioContext,
  dest: AudioNode,
  cue: SoundSource,
  at: number,
  repetition = 0,
): Handle[] {
  const ladderSemitones = cue.ladder?.[repetition] ?? 0;
  const handles: Handle[] = [];
  const { count, interval } = cue.pulses;

  for (let pulse = 0; pulse < count; pulse++) {
    const when = at + pulse * interval;

    if (cue.kind === "sample") {
      const buffer = getCachedBuffer(cue.assetId);
      if (buffer) {
        handles.push(playBuffer(ctx, dest, buffer, cue.volume, when, ladderSemitones * 100));
        continue;
      }
      // The upload is missing or failed to decode. Fall back to a preset
      // rather than leaving the timer silent.
      const fallback = DEFAULT_SETTINGS.sound.cues.alarm;
      if (fallback.kind === "synth") {
        handles.push(
          playNote(
            ctx,
            dest,
            PRESETS[fallback.preset],
            {
              freqHz: fallback.freqHz,
              waveform: fallback.waveform,
              volume: cue.volume,
            },
            when,
          ),
        );
      }
      continue;
    }

    handles.push(
      playNote(
        ctx,
        dest,
        PRESETS[cue.preset],
        {
          freqHz: cue.freqHz * semitonesToRatio(ladderSemitones),
          waveform: cue.waveform,
          volume: cue.volume,
        },
        when,
      ),
    );
  }

  return handles;
}

/**
 * Schedule every cue for a turn, at the instant of the tap.
 *
 * All of it goes on the AudioContext clock rather than a JS timer, because:
 *   - osc.start(t) is sample-accurate; setTimeout on a phone jitters by tens
 *     of milliseconds while the main thread paints a huge changing numeral,
 *     and a tick 40ms late is audible as sloppiness.
 *   - a backgrounded tab clamps setTimeout to >=1s and then to >=1min, so a
 *     timer-driven alarm would simply not fire when you're on the scoring
 *     screen. Web Audio keeps its own clock and is not throttled.
 *
 * The whole sequence is known at tap time, so there is nothing to poll — the
 * classic lookahead scheduler isn't needed here. A turn costs ~15 nodes.
 */
export function scheduleTurn(
  ctx: AudioContext,
  dest: AudioNode,
  secondsRemaining: number,
  settings: Settings,
): Handle[] {
  if (settings.sound.muted) return [];

  const zero = ctx.currentTime + LEAD_TIME + secondsRemaining;
  const handles: Handle[] = [];
  const warnAt = settings.timer.warnAtSeconds;

  // Count down from warnAt so repetition 0 is the earliest cue, which is what
  // the ladder expects.
  for (let n = warnAt; n >= 1; n--) {
    const when = zero - n;
    if (when <= ctx.currentTime) continue;
    handles.push(...playCue(ctx, dest, settings.sound.cues.tick, when, warnAt - n));
  }

  handles.push(
    ...scheduleAlarm(
      ctx,
      dest,
      settings.sound.cues.alarm,
      zero,
      settings.sound.alarmRepeats,
    ),
  );

  return handles;
}

export function cancelHandles(handles: Handle[]): void {
  for (const handle of handles) handle.cancel();
}

/**
 * Decode any configured uploads up front so scheduleTurn can stay synchronous.
 * Called on unlock and whenever the cue settings change.
 */
export async function preloadCues(
  ctx: BaseAudioContext,
  settings: Settings,
): Promise<void> {
  const ids = (Object.keys(settings.sound.cues) as CueId[])
    .map((id) => settings.sound.cues[id])
    .filter((cue): cue is Extract<SoundSource, { kind: "sample" }> => cue.kind === "sample")
    .map((cue) => cue.assetId);

  await Promise.all(ids.map((id) => loadSound(id, ctx)));
}
