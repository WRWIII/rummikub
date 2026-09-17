"use client";

import Link from "next/link";
import { useTimerSnapshot } from "@/lib/timer/use-timer";
import { TimerIcon } from "@/components/ui/icons";

/**
 * The real defence against accidental navigation isn't preventing it — it's
 * making it harmless. The engine is a module-scope singleton, so leaving the
 * timer screen never stops the turn; this just keeps it visible and one tap
 * away.
 */
export function RunningTimerChip() {
  const timer = useTimerSnapshot();
  if (timer.status === "idle") return null;

  const expired = timer.status === "expired";

  return (
    <Link
      href="/"
      aria-label="Back to the running timer"
      className={`numerals fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-lg font-bold shadow-lg shadow-black/40 ${
        expired
          ? "bg-ink-red text-tile-face"
          : "bg-tile-face text-felt"
      }`}
    >
      <TimerIcon className="h-5 w-5" />
      {expired ? "Time" : timer.displaySeconds}
    </Link>
  );
}
