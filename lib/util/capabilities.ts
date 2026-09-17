"use client";

import { useSyncExternalStore } from "react";

/**
 * Browser capability detection that survives a static export.
 *
 * Reading `'wakeLock' in navigator` directly during render is a hydration bug:
 * the build-time prerender runs in Node with no navigator and says false, the
 * browser says true, and React throws the tree away.
 *
 * useSyncExternalStore is the sanctioned way through this — the server
 * snapshot is used for both the prerender and the hydration render, so the two
 * always agree, and React re-reads the real value immediately afterwards.
 *
 * The server snapshot is optimistic (assume supported) so the common case
 * needs no correction and nothing flickers from "unsupported" to "supported".
 */
export interface Capabilities {
  wakeLock: boolean;
  vibration: boolean;
  /** Running as an installed PWA rather than in a browser tab. */
  standalone: boolean;
}

const OPTIMISTIC: Capabilities = Object.freeze({
  wakeLock: true,
  vibration: true,
  standalone: true,
});

let actual: Capabilities | null = null;

function getSnapshot(): Capabilities {
  // Cached, so the reference is stable — a fresh object per read would trip
  // React's "getSnapshot should be cached" infinite-loop guard.
  actual ??= Object.freeze({
    wakeLock: typeof navigator !== "undefined" && "wakeLock" in navigator,
    vibration: typeof navigator !== "undefined" && "vibrate" in navigator,
    standalone:
      typeof window !== "undefined" &&
      window.matchMedia("(display-mode: standalone)").matches,
  });
  return actual;
}

// Capabilities never change for the life of the page.
const subscribe = () => () => {};

export function useCapabilities(): Capabilities {
  return useSyncExternalStore(subscribe, getSnapshot, () => OPTIMISTIC);
}
