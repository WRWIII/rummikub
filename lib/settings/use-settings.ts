"use client";

import { useStore } from "@/lib/store/use-store";
import { SETTINGS_SERVER_SNAPSHOT, settingsStore } from "./store";
import type { Settings } from "./types";

export function useSettings(): Settings {
  return useStore(settingsStore, identity, SETTINGS_SERVER_SNAPSHOT);
}

// Module scope keeps the selector reference stable across renders.
function identity(state: Settings): Settings {
  return state;
}
