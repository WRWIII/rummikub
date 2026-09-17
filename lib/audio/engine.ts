/**
 * AudioContext lifecycle and the iOS unlock.
 *
 * Three genuinely separate problems get conflated as "iOS audio is broken".
 * They're handled separately below:
 *
 *   (a) The autoplay gate. A context starts suspended and resume() must be
 *       initiated from a task rooted at a user gesture. One `await` before it
 *       breaks the synchronous chain and iOS silently denies playback.
 *
 *   (b) The audio session category. A page that has only used Web Audio gets
 *       the `ambient` category, which the hardware ring/silent switch mutes.
 *       Claiming `playback` is the ONLY way past that switch — and it pauses
 *       the user's music and shows lock-screen transport controls. There is no
 *       quiet override. That trade is surfaced as a setting, not hidden.
 *
 *   (c) Context death. iOS suspends the context on backgrounding, phone calls
 *       and Siri. Never close() it, never create a second one (more than four
 *       live contexts throws on iOS).
 *
 * This app has a gift the average page doesn't: the user taps the screen every
 * turn, so there is a real gesture roughly once a minute. unlockAudio() is
 * idempotent and cheap — call it at the top of every tap handler and stop
 * worrying about whether resume() outside a gesture will succeed.
 */

/** One frame of true digital silence. */
const SILENCE_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YQQAAAAAAAAA";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let silentEl: HTMLAudioElement | null = null;
let sessionClaimed = false;

interface NavigatorWithAudioSession extends Navigator {
  audioSession?: { type: string };
}

function createContext(): AudioContext {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;

  const created = new Ctor({ latencyHint: "interactive" });

  const gain = created.createGain();
  gain.gain.value = 1;

  // Four overlapping buzzer pulses at high volume clip audibly on a phone
  // speaker without this.
  const comp = created.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 12;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;

  gain.connect(comp);
  comp.connect(created.destination);

  created.addEventListener("statechange", () => {
    if (created.state !== "running") void created.resume().catch(() => {});
  });

  ctx = created;
  master = gain;
  return created;
}

/**
 * MUST be called synchronously inside a pointerdown/click handler, before any
 * await. Safe to call on every tap.
 */
export function unlockAudio(bypassSilentSwitch: boolean): AudioContext | null {
  if (typeof window === "undefined") return null;

  let created: AudioContext;
  try {
    created = ctx ?? createContext();
  } catch {
    return null;
  }

  // (a) Fire and forget. Awaiting here would break the gesture chain for
  // everything below.
  if (created.state !== "running") void created.resume().catch(() => {});

  // (b) Get off the `ambient` category so the mute switch stops silencing us.
  if (bypassSilentSwitch && !sessionClaimed) {
    const nav = navigator as NavigatorWithAudioSession;
    if (nav.audioSession) {
      try {
        nav.audioSession.type = "playback";
        sessionClaimed = true;
      } catch {
        /* older WebKit exposes it read-only */
      }
    } else if (!silentEl) {
      // iOS 16 and older. This works because it promotes the whole page's
      // audio session, not because <audio> elements are magic. The file must
      // be genuinely silent — setting .volume = 0 does nothing on iOS.
      try {
        silentEl = new Audio(SILENCE_WAV);
        silentEl.loop = true;
        // `playsInline` is typed only on HTMLVideoElement, but WebKit honours
        // the attribute on audio too — and without it iOS may take the element
        // fullscreen instead of promoting the session.
        silentEl.setAttribute("playsinline", "");
        void silentEl.play().catch(() => {});
        sessionClaimed = true;
      } catch {
        silentEl = null;
      }
    }
  }

  // (c) The historical unlock: push one silent buffer through the graph.
  try {
    const buffer = created.createBuffer(1, 1, created.sampleRate);
    const source = created.createBufferSource();
    source.buffer = buffer;
    source.connect(created.destination);
    source.start(0);
  } catch {
    /* non-fatal */
  }

  return created;
}

/** Drops the playback session claim when the user turns the setting off. */
export function releaseSilentSwitchBypass(): void {
  const nav = navigator as NavigatorWithAudioSession;
  if (nav.audioSession) {
    try {
      nav.audioSession.type = "auto";
    } catch {
      /* ignore */
    }
  }
  if (silentEl) {
    try {
      silentEl.pause();
      silentEl.src = "";
    } catch {
      /* ignore */
    }
    silentEl = null;
  }
  sessionClaimed = false;
}

export function getContext(): AudioContext | null {
  return ctx;
}

export function getMaster(): GainNode | null {
  return master;
}

export function setMasterVolume(volume: number): void {
  if (!master || !ctx) return;
  master.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
}

let installed = false;

export function installAudioRecovery(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && ctx && ctx.state !== "running") {
      // Best effort. Architect around the next tap fixing it, not around this
      // succeeding — on iOS it may not.
      void ctx.resume().catch(() => {});
    }
  });
}

/** For the diagnostics panel — iOS can't be debugged from Windows. */
export function audioDiagnostics(): Record<string, string> {
  const nav =
    typeof navigator !== "undefined"
      ? (navigator as NavigatorWithAudioSession)
      : undefined;
  return {
    contextState: ctx?.state ?? "not created",
    sampleRate: ctx ? String(ctx.sampleRate) : "—",
    audioSession: nav?.audioSession
      ? (nav.audioSession.type ?? "unknown")
      : "unsupported",
    silentElement: silentEl ? "playing" : "none",
    sessionClaimed: String(sessionClaimed),
  };
}
