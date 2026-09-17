"use client";

import { useLayoutEffect, useRef } from "react";
import type { TimerStatus } from "@/lib/timer/engine";

/**
 * The countdown drain.
 *
 * Driven entirely by the compositor via a CSS animation — React never touches
 * it after the run starts, so the bar stays smooth while the digits re-render
 * once a second, and it costs nothing while backgrounded.
 *
 * The negative animation-delay seeks the animation to wherever the run already
 * is, which is what makes a reload mid-turn resume in the right place instead
 * of restarting from full.
 *
 * Reading Date.now() here rather than during render: render must be pure, and
 * writing the custom properties onto the DOM node is exactly the kind of
 * external-system sync an effect is for.
 */
export function DrainBar({
  status,
  startedAt,
  maxMs,
  runId,
}: {
  status: TimerStatus;
  startedAt: number | null;
  maxMs: number;
  runId: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || status !== "running" || startedAt === null) return;

    element.style.setProperty("--run-duration", `${maxMs / 1000}s`);
    element.style.setProperty(
      "--run-elapsed",
      `${Math.max(0, (Date.now() - startedAt) / 1000)}s`,
    );
    element.style.setProperty("--run-play-state", "running");
  }, [status, startedAt, maxMs, runId]);

  return (
    <div className="h-1.5 w-[min(72vw,20rem)] overflow-hidden rounded-full bg-black/25">
      {status === "running" ? (
        // Keyed on runId so a restart remounts the element and the animation
        // begins again cleanly rather than jumping.
        <div
          key={runId}
          ref={ref}
          className="drain h-full w-full rounded-full bg-tile-face/85"
        />
      ) : (
        <div
          className={`h-full rounded-full bg-tile-face/85 ${
            status === "idle" ? "w-full" : "w-0"
          }`}
        />
      )}
    </div>
  );
}
