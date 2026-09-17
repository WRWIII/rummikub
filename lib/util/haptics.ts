/**
 * Haptics.
 *
 * Honest limitation: iOS Safari does not implement the Vibration API at all.
 * This works on Android and silently does nothing on iPhone, and the settings
 * UI says so rather than presenting a toggle that appears broken.
 */

export function isVibrationSupported(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

export function vibrate(pattern: number | number[]): void {
  if (!isVibrationSupported()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

export const TICK_PATTERN = 18;

/** One burst: buzz/pause/buzz/pause/long buzz. Runs 1000ms end to end. */
const ALARM_BURST = [200, 100, 200, 100, 400];

/**
 * Chosen so a burst plus a gap is ~1.4s, which is what one firing of the
 * default alarm cue occupies (see ALARM_REST in audio/cues.ts). The buzzing
 * then lands with the sound instead of drifting ahead of it.
 */
const ALARM_BURST_GAP = 400;

/**
 * Vibration patterns alternate buzz/pause and must start on a buzz, so
 * repeats are joined with an explicit gap rather than concatenated.
 */
export function alarmPattern(repeats: number): number[] {
  const pattern: number[] = [];
  for (let i = 0; i < repeats; i++) {
    if (i > 0) pattern.push(ALARM_BURST_GAP);
    pattern.push(...ALARM_BURST);
  }
  return pattern;
}
