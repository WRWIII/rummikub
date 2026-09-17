import {
  STORAGE_KEYS,
  readEnvelope,
  removeKey,
  writeEnvelope,
} from "@/lib/persist/local-storage";

/**
 * The timer engine.
 *
 * Nothing in here counts down. A tap records an absolute deadline timestamp
 * and every reading is derived from `deadlineAt - Date.now()`. There is no
 * accumulator to drift, so a delayed, coalesced or skipped tick changes only
 * WHEN the display updates, never WHAT it says.
 *
 * Date.now() rather than performance.now(): the epoch value survives a reload
 * and a PWA relaunch, so a phone that gets killed mid-turn comes back showing
 * the right number. Wall-clock skew over a 60-second window is irrelevant.
 *
 * No React imports. This is a module-scope singleton so the timer keeps
 * running across navigation.
 */

export type TimerStatus = "idle" | "running" | "expired";

export interface TimerSnapshot {
  status: TimerStatus;
  maxMs: number;
  startedAt: number | null;
  deadlineAt: number | null;
  /** Quantised to whole seconds — the only field that re-renders React. */
  displaySeconds: number;
  /** Bumped on every start/restart. Invalidates anything scheduled earlier. */
  runId: number;
}

export interface TimerRun {
  runId: number;
  startedAt: number;
  deadlineAt: number;
  maxMs: number;
  warnAtSeconds: number;
}

type RunStartListener = (run: TimerRun) => void;
type RunCancelListener = (runId: number) => void;
type ExpireListener = (runId: number, lateByMs: number) => void;
type CueListener = (secondsRemaining: number, runId: number) => void;

const VERSION = 1;
const DEFAULT_MAX_MS = 60_000;

/** Past this, a restored deadline is stale rubbish rather than a live turn. */
const STALE_DEADLINE_MS = 10 * 60_000;

/**
 * An alarm that fires 40 seconds late because the phone was pocketed is worse
 * than no alarm at all. Beyond this, land silently on zero.
 */
const MAX_LATE_ALARM_MS = 3_000;

interface PersistedTimer {
  runId: number;
  startedAt: number;
  deadlineAt: number;
  maxMs: number;
}

/* ----------------------------- internal state ---------------------------- */

let snapshot: TimerSnapshot = {
  status: "idle",
  maxMs: DEFAULT_MAX_MS,
  startedAt: null,
  deadlineAt: null,
  displaySeconds: DEFAULT_MAX_MS / 1000,
  runId: 0,
};

const subscribers = new Set<() => void>();
const runStartListeners = new Set<RunStartListener>();
const runCancelListeners = new Set<RunCancelListener>();
const expireListeners = new Set<ExpireListener>();
const cueListeners = new Set<CueListener>();

let timeout: ReturnType<typeof setTimeout> | null = null;
let warnAtSeconds = 3;

/** Thresholds already announced this run. Cleared on every start. */
const firedCues = new Set<number>();

let installed = false;

/* --------------------------------- utils -------------------------------- */

function emit(): void {
  for (const listener of subscribers) listener();
}

function commit(next: Partial<TimerSnapshot>): void {
  const merged = { ...snapshot, ...next };
  // Identity is the change signal for useSyncExternalStore, so only replace
  // the object when something actually differs.
  if (
    merged.status === snapshot.status &&
    merged.maxMs === snapshot.maxMs &&
    merged.startedAt === snapshot.startedAt &&
    merged.deadlineAt === snapshot.deadlineAt &&
    merged.displaySeconds === snapshot.displaySeconds &&
    merged.runId === snapshot.runId
  ) {
    return;
  }
  snapshot = merged;
  emit();
}

function secondsFrom(remainingMs: number): number {
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

function clearPending(): void {
  if (timeout !== null) {
    clearTimeout(timeout);
    timeout = null;
  }
}

function persist(run: PersistedTimer | null): void {
  if (run === null) removeKey(STORAGE_KEYS.timer);
  else writeEnvelope(STORAGE_KEYS.timer, VERSION, run);
}

/* ------------------------------- the loop -------------------------------- */

function tick(): void {
  timeout = null;
  if (snapshot.status !== "running" || snapshot.deadlineAt === null) return;

  const remaining = snapshot.deadlineAt - Date.now();

  if (remaining <= 0) {
    expire(-remaining);
    return;
  }

  const seconds = secondsFrom(remaining);
  commit({ displaySeconds: seconds });

  // Non-audio cues (haptics). Audio does NOT come through here — it's
  // pre-scheduled on the AudioContext clock at tap time, because a JS timer
  // is clamped to >=1s when the tab is hidden and jitters badly even awake.
  if (seconds <= warnAtSeconds && seconds > 0) {
    fireCue(seconds);
  }

  schedule(remaining);
}

/**
 * Align each wake to the next whole-second boundary and re-derive from the
 * clock every time, so the loop self-corrects instead of accumulating error.
 * The +4ms guards against waking a hair early and rendering the same number
 * twice.
 */
function schedule(remainingMs: number): void {
  clearPending();
  const delay = (remainingMs % 1000 || 1000) + 4;
  timeout = setTimeout(tick, delay);
}

/**
 * A single stalled tick can cross 3, 2 and 1 at once. Mark every crossed
 * threshold as fired but announce only the lowest, or the user gets three
 * buzzes in one frame.
 */
function fireCue(seconds: number): void {
  let lowest: number | null = null;
  for (let s = warnAtSeconds; s >= seconds; s--) {
    if (!firedCues.has(s)) {
      firedCues.add(s);
      lowest = lowest === null ? s : Math.min(lowest, s);
    }
  }
  if (lowest === null) return;
  const announce = Math.min(lowest, seconds);
  for (const listener of cueListeners) listener(announce, snapshot.runId);
}

function expire(lateByMs: number): void {
  clearPending();
  const runId = snapshot.runId;
  commit({ status: "expired", displaySeconds: 0 });
  persist(null);

  if (lateByMs <= MAX_LATE_ALARM_MS) {
    for (const listener of expireListeners) listener(runId, lateByMs);
  }
}

/* -------------------------------- actions -------------------------------- */

function cancelRun(): void {
  clearPending();
  firedCues.clear();
  const runId = snapshot.runId;
  for (const listener of runCancelListeners) listener(runId);
}

function start(): void {
  cancelRun();

  const now = Date.now();
  const runId = snapshot.runId + 1;
  const deadlineAt = now + snapshot.maxMs;

  commit({
    status: "running",
    startedAt: now,
    deadlineAt,
    displaySeconds: secondsFrom(snapshot.maxMs),
    runId,
  });

  persist({ runId, startedAt: now, deadlineAt, maxMs: snapshot.maxMs });

  const run: TimerRun = {
    runId,
    startedAt: now,
    deadlineAt,
    maxMs: snapshot.maxMs,
    warnAtSeconds,
  };
  for (const listener of runStartListeners) listener(run);

  schedule(snapshot.maxMs);
}

/**
 * The entire gesture API. Always "start", from every state:
 *   idle    -> start
 *   running -> cancel and restart from the top
 *   expired -> silence the alarm and restart
 * One function, no modes.
 */
export function poke(): void {
  start();
}

/** Back to idle at max. Used by settings, not by the tap surface. */
export function reset(): void {
  cancelRun();
  persist(null);
  commit({
    status: "idle",
    startedAt: null,
    deadlineAt: null,
    displaySeconds: Math.round(snapshot.maxMs / 1000),
  });
}

export function setMaxMs(ms: number): void {
  if (ms === snapshot.maxMs) return;
  if (snapshot.status === "running") {
    // Changing the turn length mid-run would make the visible number jump.
    // Store it; it takes effect on the next tap.
    snapshot = { ...snapshot, maxMs: ms };
    emit();
    return;
  }
  commit({
    maxMs: ms,
    displaySeconds: Math.round(ms / 1000),
  });
}

export function setWarnAtSeconds(seconds: number): void {
  warnAtSeconds = seconds;
}

/* ------------------------------ subscription ----------------------------- */

export function subscribe(listener: () => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export function getSnapshot(): TimerSnapshot {
  return snapshot;
}

/** Stable frozen value for the build-time prerender and hydration render. */
export const TIMER_SERVER_SNAPSHOT: TimerSnapshot = Object.freeze({
  status: "idle" as const,
  maxMs: DEFAULT_MAX_MS,
  startedAt: null,
  deadlineAt: null,
  displaySeconds: DEFAULT_MAX_MS / 1000,
  runId: 0,
});

export function getServerSnapshot(): TimerSnapshot {
  return TIMER_SERVER_SNAPSHOT;
}

function addListener<T>(set: Set<T>, listener: T): () => void {
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

export const onRunStart = (l: RunStartListener) => addListener(runStartListeners, l);
export const onRunCancel = (l: RunCancelListener) => addListener(runCancelListeners, l);
export const onExpire = (l: ExpireListener) => addListener(expireListeners, l);
export const onCue = (l: CueListener) => addListener(cueListeners, l);

/* -------------------------- boot + visibility ---------------------------- */

/**
 * Restore a run that was in flight when the page was unloaded. Called once at
 * install time, guarded so it never runs during the Node prerender.
 */
function restore(): void {
  const envelope = readEnvelope(STORAGE_KEYS.timer);
  if (!envelope) return;

  const data = envelope.data as Partial<PersistedTimer> | null;
  if (
    !data ||
    typeof data.deadlineAt !== "number" ||
    typeof data.maxMs !== "number" ||
    typeof data.runId !== "number" ||
    typeof data.startedAt !== "number"
  ) {
    removeKey(STORAGE_KEYS.timer);
    return;
  }

  const remaining = data.deadlineAt - Date.now();

  if (remaining <= -STALE_DEADLINE_MS) {
    removeKey(STORAGE_KEYS.timer);
    return;
  }

  if (remaining <= 0) {
    snapshot = {
      status: "expired",
      maxMs: data.maxMs,
      startedAt: data.startedAt,
      deadlineAt: data.deadlineAt,
      displaySeconds: 0,
      runId: data.runId,
    };
    removeKey(STORAGE_KEYS.timer);
    return;
  }

  snapshot = {
    status: "running",
    maxMs: data.maxMs,
    startedAt: data.startedAt,
    deadlineAt: data.deadlineAt,
    displaySeconds: secondsFrom(remaining),
    runId: data.runId,
  };
}

/**
 * Re-derive from the clock on every return to visibility. Never trust what the
 * JS timer would have done while hidden — mobile clamps setTimeout to >=1s
 * when backgrounded and iOS can suspend JS entirely on lock.
 */
function handleVisibilityChange(): void {
  if (document.visibilityState !== "visible") return;
  if (snapshot.status !== "running" || snapshot.deadlineAt === null) return;

  clearPending();
  const remaining = snapshot.deadlineAt - Date.now();

  if (remaining <= 0) {
    expire(-remaining);
    return;
  }

  commit({ displaySeconds: secondsFrom(remaining) });

  // Audio scheduled on the old AudioContext timeline has drifted if the
  // context was suspended. Re-announce the run so it reschedules from here.
  const run: TimerRun = {
    runId: snapshot.runId,
    startedAt: snapshot.startedAt ?? Date.now(),
    deadlineAt: snapshot.deadlineAt,
    maxMs: snapshot.maxMs,
    warnAtSeconds,
  };
  for (const listener of runCancelListeners) listener(snapshot.runId);
  for (const listener of runStartListeners) listener(run);

  schedule(remaining);
}

/** Idempotent: StrictMode double-mounts, and the engine must survive that. */
export function installEngine(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  restore();
  document.addEventListener("visibilitychange", handleVisibilityChange);

  if (snapshot.status === "running" && snapshot.deadlineAt !== null) {
    schedule(snapshot.deadlineAt - Date.now());
  }

  // restore() assigns the snapshot directly, so anything already subscribed
  // needs telling. Harmless when nothing was restored.
  emit();
}
