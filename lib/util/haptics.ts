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
export const ALARM_PATTERN = [200, 100, 200, 100, 400];
