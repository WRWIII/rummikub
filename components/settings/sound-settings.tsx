"use client";

import { useRef, useState } from "react";
import {
  Row,
  SegmentedControl,
  Section,
  Slider,
  Toggle,
} from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { TrashIcon } from "@/components/ui/icons";
import { PRESETS, PRESET_IDS, type PresetId } from "@/lib/audio/presets";
import { playCue, preloadCues } from "@/lib/audio/cues";
import type { Handle } from "@/lib/audio/synth";
import {
  getContext,
  getMaster,
  releaseSilentSwitchBypass,
  unlockAudio,
} from "@/lib/audio/engine";
import {
  MAX_UPLOAD_BYTES,
  SoundImportError,
  deleteSound,
  importSound,
} from "@/lib/audio/samples";
import {
  WAVEFORMS,
  settingsStore,
  updateCue,
  updateSoundSettings,
} from "@/lib/settings/store";
import { useSettings } from "@/lib/settings/use-settings";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import type { CueId, SoundSource } from "@/lib/settings/types";

export function SoundSettings() {
  const settings = useSettings();
  const { sound } = settings;

  return (
    <>
      <Section title="Sound">
        <Row
          label="Mute all cues"
          control={
            <Toggle
              label="Mute all cues"
              checked={sound.muted}
              onChange={(muted) => updateSoundSettings({ muted })}
            />
          }
        />
        <Row
          label="Volume"
          control={
            <Slider
              label="Master volume"
              value={sound.masterVolume}
              min={0}
              max={1}
              step={0.05}
              onChange={(masterVolume) => updateSoundSettings({ masterVolume })}
            />
          }
        />
        <Row
          label="Play on silent"
          hint="Sounds the alarm even with the ring/silent switch flipped. Pauses other audio and puts playback controls on the lock screen — that's the only way past the switch on iPhone."
          control={
            <Toggle
              label="Play on silent"
              checked={sound.bypassSilentSwitch}
              onChange={(bypassSilentSwitch) => {
                updateSoundSettings({ bypassSilentSwitch });
                if (!bypassSilentSwitch) releaseSilentSwitchBypass();
              }}
            />
          }
        />
      </Section>

      <CueEditor
        cueId="tick"
        title="Count-in ticks"
        description="Plays through the final seconds, rising in pitch as it goes."
      />
      <CueEditor
        cueId="alarm"
        title="Time-up alarm"
        description="Fires the moment the turn runs out."
      />
    </>
  );
}

function CueEditor({
  cueId,
  title,
  description,
}: {
  cueId: CueId;
  title: string;
  description: string;
}) {
  const settings = useSettings();
  const cue = settings.sound.cues[cueId];
  const preview = useRef<Handle[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stopPreview = () => {
    for (const handle of preview.current) handle.cancel();
    preview.current = [];
  };

  /**
   * pointerdown rather than click: lower latency, and an unambiguous user
   * gesture, which is what iOS needs to let the context resume. Every test
   * press doubles as a free re-unlock.
   */
  const test = () => {
    const current = settingsStore.get();
    const ctx = unlockAudio(current.sound.bypassSilentSwitch);
    const master = getMaster();
    if (!ctx || !master) return;

    stopPreview();
    const at = ctx.currentTime + 0.05;

    if (cueId === "tick") {
      // Walk the ladder so the rise is audible.
      const steps = cue.ladder?.length ?? 1;
      for (let i = 0; i < steps; i++) {
        preview.current.push(...playCue(ctx, master, cue, at + i * 0.6, i));
      }
    } else {
      preview.current.push(...playCue(ctx, master, cue, at, 0));
    }
  };

  const patch = (next: Partial<SoundSource>) => {
    updateCue(cueId, { ...cue, ...next } as SoundSource);
  };

  const handleFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const current = settingsStore.get();
      // Decoding works on a suspended context, so this doesn't need a gesture.
      const ctx = getContext() ?? unlockAudio(current.sound.bypassSilentSwitch);
      if (!ctx) throw new SoundImportError("Audio isn't available in this browser.");

      const record = await importSound(file, ctx);
      updateCue(cueId, {
        kind: "sample",
        assetId: record.id,
        fileName: record.name,
        volume: cue.volume,
        pulses: cue.pulses,
        ladder: cue.ladder,
      });
      await preloadCues(ctx, settingsStore.get());
    } catch (caught) {
      setError(
        caught instanceof SoundImportError
          ? caught.message
          : "Something went wrong reading that file.",
      );
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const revertToPreset = async () => {
    if (cue.kind !== "sample") return;
    const fallback = DEFAULT_SETTINGS.sound.cues[cueId];
    await deleteSound(cue.assetId);
    updateCue(cueId, { ...fallback, volume: cue.volume });
  };

  return (
    <Section title={title} description={description}>
      {cue.kind === "synth" ? (
        <>
          <div className="border-b border-white/7 px-4 py-3">
            <SegmentedControl
              label={`${title} sound`}
              value={cue.preset}
              options={PRESET_IDS.map((id) => ({
                value: id,
                label: PRESETS[id].label,
              }))}
              onChange={(preset: PresetId) =>
                patch({
                  preset,
                  freqHz: PRESETS[preset].baseFreq,
                  waveform: PRESETS[preset].partials[0].type,
                })
              }
            />
          </div>

          <Row
            label="Pitch"
            control={
              <Slider
                label={`${title} pitch`}
                value={cue.freqHz}
                min={120}
                max={2000}
                step={10}
                onChange={(freqHz) => patch({ freqHz })}
              />
            }
          />

          <div className="border-b border-white/7 px-4 py-3">
            <SegmentedControl
              label={`${title} waveform`}
              value={cue.waveform as (typeof WAVEFORMS)[number]}
              options={WAVEFORMS.map((waveform) => ({
                value: waveform,
                label: waveform[0].toUpperCase() + waveform.slice(1),
              }))}
              onChange={(waveform) => patch({ waveform })}
            />
          </div>
        </>
      ) : (
        <Row
          label={cue.fileName}
          hint="Your own file"
          control={
            <Button
              variant="ghost"
              className="min-h-10 px-3 text-sm"
              onClick={revertToPreset}
              aria-label="Remove custom sound"
            >
              <TrashIcon className="h-5 w-5" />
            </Button>
          }
        />
      )}

      <Row
        label="Level"
        control={
          <Slider
            label={`${title} level`}
            value={cue.volume}
            min={0}
            max={1}
            step={0.05}
            onChange={(volume) => patch({ volume })}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <Button
          variant="secondary"
          className="min-h-11"
          onPointerDown={(event) => {
            event.preventDefault();
            test();
          }}
        >
          Test
        </Button>
        <Button variant="ghost" className="min-h-11" onClick={stopPreview}>
          Stop
        </Button>
        <Button
          variant="ghost"
          className="min-h-11"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {busy ? "Reading…" : "Use my own file"}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>

      {error && (
        <p className="px-4 pb-3 text-sm text-ink-orange">{error}</p>
      )}

      <p className="px-4 pb-3 text-xs text-tile-face/40">
        WAV, M4A/AAC or MP3, under {MAX_UPLOAD_BYTES / 1024 / 1024} MB and 5 seconds.
        OGG files won&rsquo;t play on iPhone. Files stay on this device.
      </p>
    </Section>
  );
}
