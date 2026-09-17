"use client";

import { useEffect, useState } from "react";
import { audioDiagnostics } from "@/lib/audio/engine";
import { isWakeLockHeld, isWakeLockSupported } from "@/lib/timer/wake-lock";
import { isVibrationSupported } from "@/lib/util/haptics";

/**
 * There is no way to remote-debug iOS Safari from Windows, so when something
 * doesn't make a sound on someone's iPhone this panel is the only instrument
 * available. Worth its ~60 lines.
 */
export function DiagnosticsPanel() {
  const [rows, setRows] = useState<[string, string][]>([]);

  useEffect(() => {
    const read = () => {
      const audio = audioDiagnostics();
      setRows([
        ["Audio context", audio.contextState],
        ["Sample rate", audio.sampleRate],
        ["Audio session", audio.audioSession],
        ["Silent-audio shim", audio.silentElement],
        ["Session claimed", audio.sessionClaimed],
        [
          "Wake lock",
          isWakeLockSupported()
            ? isWakeLockHeld()
              ? "held"
              : "supported, not held"
            : "unsupported",
        ],
        ["Vibration", isVibrationSupported() ? "supported" : "unsupported"],
        [
          "Display mode",
          window.matchMedia("(display-mode: standalone)").matches
            ? "installed"
            : "browser tab",
        ],
        [
          "Service worker",
          "serviceWorker" in navigator
            ? navigator.serviceWorker.controller
              ? "controlling"
              : "registered or pending"
            : "unsupported",
        ],
        ["Build", process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"],
      ]);
    };

    read();
    const handle = setInterval(read, 1000);
    return () => clearInterval(handle);
  }, []);

  return (
    <details className="mb-10 rounded-2xl bg-white/4 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-tile-face/50">
        Diagnostics
      </summary>
      <dl className="mt-3 space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 text-xs">
            <dt className="text-tile-face/45">{label}</dt>
            <dd className="text-right font-mono text-tile-face/75">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
