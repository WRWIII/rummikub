"use client";

import { useStore } from "@/lib/store/use-store";
import { MATCH_SERVER_SNAPSHOT, matchStore } from "./store";
import type { MatchState } from "./types";

export function useMatchState(): MatchState {
  return useStore(matchStore, identity, MATCH_SERVER_SNAPSHOT);
}

// Module-scope so the selector reference is stable across renders.
function identity(state: MatchState): MatchState {
  return state;
}
