/**
 * localStorage access that never throws.
 *
 * Safari in private mode throws QuotaExceededError on setItem, and a storage
 * failure must never take down a click handler mid-game. Every read falls back
 * to the supplied default; every write is swallowed.
 *
 * Values are wrapped in a `{ v, data }` envelope so a future schema change can
 * be migrated rather than bricking someone's saved match.
 */

export interface Envelope<T> {
  v: number;
  data: T;
}

export const STORAGE_KEYS = {
  settings: "rkt:v1:settings",
  match: "rkt:v1:match",
  matchPrevious: "rkt:v1:match:previous",
  timer: "rkt:v1:timer",
} as const;

export function readEnvelope(key: string): Envelope<unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "v" in parsed &&
      "data" in parsed
    ) {
      return parsed as Envelope<unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeEnvelope<T>(key: string, version: number, data: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ v: version, data }));
  } catch {
    // Private mode, quota exhausted, or storage disabled. Nothing we can do
    // that's better than carrying on with in-memory state.
  }
}

export function removeKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Trailing-debounced writer. Round-entry keystrokes and volume-slider drags
 * would otherwise hammer localStorage synchronously and jank the input.
 */
export function createDebouncedWriter<T>(
  key: string,
  version: number,
  delayMs = 250,
): (data: T) => void {
  let handle: ReturnType<typeof setTimeout> | null = null;
  let pending: T | null = null;

  const flush = () => {
    handle = null;
    if (pending !== null) {
      writeEnvelope(key, version, pending);
      pending = null;
    }
  };

  if (typeof window !== "undefined") {
    // A backgrounded PWA may never run the pending timeout, so force a write
    // on the way out.
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  return (data: T) => {
    pending = data;
    if (handle !== null) clearTimeout(handle);
    handle = setTimeout(flush, delayMs);
  };
}

/** Cross-tab sync. Cheap, and stops one tab silently clobbering another. */
export function subscribeToKey(
  key: string,
  onChange: (envelope: Envelope<unknown> | null) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (event: StorageEvent) => {
    if (event.key !== key) return;
    onChange(readEnvelope(key));
  };

  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
