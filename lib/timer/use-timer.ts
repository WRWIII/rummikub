"use client";

import { useSyncExternalStore } from "react";
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  type TimerSnapshot,
} from "./engine";

export function useTimerSnapshot(): TimerSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export { poke, reset } from "./engine";
