/**
 * A minimal external store.
 *
 * Every piece of app state lives in one of these, at module scope, outside
 * React. That's what lets the timer keep running across navigation and lets
 * stores hydrate from localStorage synchronously before the first render.
 *
 * The one invariant that matters: `set` must produce a NEW top-level object
 * exactly once per mutation. useSyncExternalStore uses reference identity as
 * the change signal, and returning a fresh object on every read instead
 * triggers React's "getSnapshot should be cached" infinite-loop error.
 */
export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => value,

    set(next) {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(value) : next;
      if (Object.is(resolved, value)) return;
      value = resolved;
      for (const listener of listeners) listener();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
