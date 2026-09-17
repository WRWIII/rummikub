"use client";

import { useId } from "react";
import { InlineScript } from "@/components/inline-script";
import { STORAGE_KEYS } from "@/lib/persist/local-storage";
import type { TimerStatus } from "@/lib/timer/engine";

export type TileTone = "black" | "blue" | "orange" | "red";

const TONE_VAR: Record<TileTone, string> = {
  black: "var(--color-ink-black)",
  blue: "var(--color-ink-blue)",
  orange: "var(--color-ink-orange)",
  red: "var(--color-ink-red)",
};

/**
 * The first-paint correction.
 *
 * Runs synchronously during HTML parsing, before React loads, so opening the
 * app mid-turn paints the true remaining seconds in the very first frame
 * instead of the build-time default. Reads exactly the same storage the client
 * store reads, so React's hydrated value already matches the DOM — and the
 * span carries suppressHydrationWarning so the DOM wins either way.
 */
function bootSnippet(id: string): string {
  return `{try{
var e=document.getElementById(${JSON.stringify(id)});
if(e){
var s=60,r=localStorage.getItem(${JSON.stringify(STORAGE_KEYS.settings)});
if(r){var p=JSON.parse(r);if(p&&p.data&&p.data.timer&&p.data.timer.maxSeconds)s=p.data.timer.maxSeconds}
var t=localStorage.getItem(${JSON.stringify(STORAGE_KEYS.timer)});
if(t){var q=JSON.parse(t);if(q&&q.data&&q.data.deadlineAt){var m=q.data.deadlineAt-Date.now();s=m>0?Math.ceil(m/1000):0}}
e.textContent=String(s)}}catch(_){}}`.replace(/\n/g, "");
}

export function TimerTile({
  seconds,
  tone,
  status,
  pulsing,
}: {
  seconds: number;
  tone: TileTone;
  status: TimerStatus;
  pulsing: boolean;
}) {
  const id = useId();
  const expired = status === "expired";

  return (
    <div
      className={`tile relative aspect-[3/4] w-[min(72vw,20rem)] rounded-[1.75rem] transition-transform ${
        pulsing ? "pulsing" : ""
      }`}
      style={{ color: TONE_VAR[tone] }}
    >
      {expired ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <JokerFace />
        </div>
      ) : (
        <>
          {/* Positioned rather than centred: on a real tile the numeral sits
              high and the circle sits low, which is what makes it read as a
              tile instead of a card. */}
          <span
            id={id}
            suppressHydrationWarning
            className="numerals absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 text-[clamp(5rem,27vw,9.5rem)] font-bold leading-none"
          >
            {seconds}
          </span>
          <InlineScript html={bootSnippet(id)} />
          <span
            aria-hidden
            className="absolute left-1/2 top-[74%] h-[0.6rem] w-[0.6rem] -translate-x-1/2 rounded-full bg-current opacity-85"
          />
        </>
      )}
    </div>
  );
}

/**
 * The joker face from the tile set. Unmistakable from across a table — the
 * turn is over.
 *
 * Drawn as paths rather than shipped as an image so it stays crisp at any tile
 * size, takes its colour from the tile's current ink (`currentColor`), and
 * costs no extra request offline.
 */
function JokerFace() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="w-[54%]"
      fill="none"
      stroke="currentColor"
      strokeWidth={5.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="50" cy="50" r="44" strokeWidth={7} />

      {/* Brows, arched high so they clear the eyes */}
      <path d="M21 44Q29 31 41 38" />
      <path d="M79 44Q71 31 59 38" />

      {/* Two ticks at the top of the nose bridge, between the brows */}
      <path d="M46 40 45 45" strokeWidth={4} />
      <path d="M54 40 55 45" strokeWidth={4} />

      {/* Eyes. Set well outboard: any wider and their inner corners run into
          the nose, and the whole middle of the face reads as one band. */}
      <path d="M20 54Q30 47 40 54 30 61 20 54Z" />
      <path d="M80 54Q70 47 60 54 70 61 80 54Z" />
      <circle cx="30" cy="54" r="2.8" fill="currentColor" stroke="none" />
      <circle cx="70" cy="54" r="2.8" fill="currentColor" stroke="none" />

      {/* Nose, passing between the eyes and curling at the tip */}
      <path d="M50 48v18q0 5-5 4" />

      {/* The grin, with the ends curled up */}
      <path d="M24 70q3 8 9 6 8 10 17 10t17-10q6 2 9-6" />
    </svg>
  );
}
