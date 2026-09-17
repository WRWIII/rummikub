import { describe, expect, it } from "vitest";
import { migrateSettings } from "./store";
import { DEFAULT_SETTINGS, MAX_WARN_SECONDS } from "./defaults";

/**
 * These all guard the same class of bug: a sound setting that quietly keeps
 * playing something the user switched off.
 */
describe("migrateSettings", () => {
  it("collapses an uploaded cue to a single firing", () => {
    // What the app actually wrote before the invariant existed: the file
    // inherited the buzzer's four-pulse burst, so it played four times over
    // however many alarm repeats were configured.
    const migrated = migrateSettings(
      {
        sound: {
          cues: {
            alarm: {
              kind: "sample",
              assetId: "abc",
              fileName: "airhorn.m4a",
              volume: 0.9,
              pulses: { count: 4, interval: 0.22 },
            },
          },
        },
      },
      2,
    );

    expect(migrated.sound.cues.alarm).toMatchObject({
      kind: "sample",
      assetId: "abc",
      pulses: { count: 1, interval: 0 },
    });
  });

  it("leaves a synth cue's burst pattern alone", () => {
    // The buzzer's four pulses are the sound, not a repeat count.
    const migrated = migrateSettings(DEFAULT_SETTINGS, 2);
    expect(migrated.sound.cues.alarm.pulses).toEqual({
      count: 4,
      interval: 0.22,
    });
  });

  it("accepts only the offered alarm repeat counts", () => {
    for (const [stored, expected] of [
      [1, 1],
      [3, 3],
      [2, DEFAULT_SETTINGS.sound.alarmRepeats],
      ["nonsense", DEFAULT_SETTINGS.sound.alarmRepeats],
      [undefined, DEFAULT_SETTINGS.sound.alarmRepeats],
    ] as const) {
      expect(
        migrateSettings({ sound: { alarmRepeats: stored } }, 2).sound
          .alarmRepeats,
      ).toBe(expected);
    }
  });

  it("caps the count-in at the pitch ladder's length", () => {
    // Beyond the ladder every tone lands on the same pitch, which is ticking.
    const migrated = migrateSettings({ timer: { warnAtSeconds: 10 } }, 2);
    expect(migrated.timer.warnAtSeconds).toBe(MAX_WARN_SECONDS);
  });

  it("drops v1 cue overrides but keeps the turn length", () => {
    const migrated = migrateSettings(
      {
        timer: { maxSeconds: 90 },
        sound: { cues: { tick: { kind: "synth", preset: "beep" } } },
      },
      1,
    );
    expect(migrated.timer.maxSeconds).toBe(90);
    expect(migrated.sound.cues.tick).toEqual(DEFAULT_SETTINGS.sound.cues.tick);
  });
});
