"use client";

import { Row, SegmentedControl, Section, Stepper, Toggle } from "@/components/ui/fields";
import {
  MAX_SECONDS,
  MAX_WARN_SECONDS,
  MIN_SECONDS,
} from "@/lib/settings/defaults";
import { setMaxSeconds, updateTimerSettings } from "@/lib/settings/store";
import { useSettings } from "@/lib/settings/use-settings";
import { useCapabilities } from "@/lib/util/capabilities";

export function TimerSettings() {
  const settings = useSettings();
  const { timer } = settings;

  // Not read directly from `navigator` during render — see capabilities.ts.
  const { wakeLock: wakeLockSupported, vibration: vibrationSupported } =
    useCapabilities();

  return (
    <Section title="Turn">
      <Row
        label="Turn length"
        control={
          <Stepper
            label="turn length"
            value={timer.maxSeconds}
            min={MIN_SECONDS}
            max={MAX_SECONDS}
            step={5}
            suffix="s"
            onChange={setMaxSeconds}
          />
        }
      />

      <div className="border-b border-white/7 px-4 py-3">
        <SegmentedControl
          label="Turn length presets"
          value={String(timer.maxSeconds)}
          options={timer.presetSeconds.map((seconds) => ({
            value: String(seconds),
            label: `${seconds}s`,
          }))}
          onChange={(next) => setMaxSeconds(Number(next))}
        />
      </div>

      <Row
        label="Count-in tones"
        hint="Rising tones over the final seconds. Capped at three — beyond that they stop rising and turn into ticking."
        control={
          <Stepper
            label="count-in seconds"
            value={timer.warnAtSeconds}
            min={0}
            max={MAX_WARN_SECONDS}
            suffix="s"
            onChange={(warnAtSeconds) => updateTimerSettings({ warnAtSeconds })}
          />
        }
      />

      <Row
        label="Keep the screen awake"
        hint={
          wakeLockSupported
            ? "Stops the phone dimming mid-turn. Released as soon as the timer stops."
            : "Not supported in this browser — set your phone's auto-lock to a longer interval instead."
        }
        control={
          <Toggle
            label="Keep the screen awake"
            checked={timer.keepAwake && wakeLockSupported}
            onChange={(keepAwake) => updateTimerSettings({ keepAwake })}
          />
        }
      />

      <Row
        label="Vibrate on cues"
        hint={
          vibrationSupported
            ? "Buzzes on the count-in tones and at zero."
            : "Not available on iPhone — Safari doesn't support vibration at all."
        }
        control={
          <Toggle
            label="Vibrate on cues"
            checked={timer.haptics && vibrationSupported}
            onChange={(haptics) => updateTimerSettings({ haptics })}
          />
        }
      />
    </Section>
  );
}
