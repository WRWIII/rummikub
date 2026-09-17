/**
 * Screen Wake Lock.
 *
 * Supported on Chrome/Edge Android 84+, Firefox 126+, and Safari 16.4+ — which
 * happens to be exactly Next 16's own browser baseline. Installed PWAs on iOS
 * were broken by an Apple bug until 18.4.
 *
 * Every failure mode here is non-fatal. The lock is a nicety; the app is
 * tapped every ~60 seconds anyway, which resets the OS idle timer on its own.
 */

let sentinel: WakeLockSentinel | null = null;
let wanted = false;

export function isWakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

export function isWakeLockHeld(): boolean {
  return sentinel !== null;
}

/**
 * Safari wants a user gesture, so call this from the same handler as the tap.
 * Re-acquisition on visibilitychange is not a gesture; Chrome allows it and
 * Safari usually does, but a refusal is fine — the next tap fixes it.
 */
export async function acquireWakeLock(): Promise<void> {
  wanted = true;
  if (!isWakeLockSupported() || sentinel !== null) return;
  try {
    sentinel = await navigator.wakeLock.request("screen");
    sentinel.addEventListener("release", () => {
      sentinel = null;
    });
  } catch {
    // NotAllowedError: low battery, no gesture, or unsupported. Degrade.
    sentinel = null;
  }
}

export async function releaseWakeLock(): Promise<void> {
  wanted = false;
  const current = sentinel;
  sentinel = null;
  try {
    await current?.release();
  } catch {
    /* already gone */
  }
}

let installed = false;

/** The OS drops the lock whenever the document hides. Take it back. */
export function installWakeLockRecovery(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && wanted && sentinel === null) {
      void acquireWakeLock();
    }
  });
}
