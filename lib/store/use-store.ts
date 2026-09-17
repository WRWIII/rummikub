"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Store } from "./create-store";

/**
 * Subscribe a component to a store.
 *
 * `serverSnapshot` is used for the build-time prerender AND for the hydration
 * render, so the two always agree and a hydration mismatch is structurally
 * impossible. It must be a stable frozen constant — see the store modules.
 *
 * Selectors must return primitives or stable references. A selector that
 * builds a fresh object each call reintroduces the cached-snapshot crash;
 * derive objects through a memo keyed on the source object's identity instead.
 */
export function useStore<T, S = T>(
  store: Store<T>,
  selector: (state: T) => S,
  serverSnapshot: T,
): S {
  const getSnapshot = useCallback(
    () => selector(store.get()),
    [store, selector],
  );

  const getServerSnapshot = useCallback(
    () => selector(serverSnapshot),
    [selector, serverSnapshot],
  );

  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}
