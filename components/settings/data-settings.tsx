"use client";

import { useEffect, useRef, useState } from "react";
import { Row, Section } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/sheet";
import { importMatch, matchStore } from "@/lib/match/store";
import { clearAll } from "@/lib/match/store";
import { resetSettings, settingsStore, migrateSettings } from "@/lib/settings/store";
import { useCapabilities } from "@/lib/util/capabilities";

/**
 * The actual backup story.
 *
 * Safari's tracking prevention deletes all script-writable storage — including
 * IndexedDB and the service worker cache — after 7 days of Safari use without
 * interaction with the site. Home-screen installs are exempt, which is why
 * there's an install nudge below, but an export is the honest fallback.
 */
export function DataSettings() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const { standalone: installed } = useCapabilities();

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      void navigator.storage
        .estimate()
        .then((estimate) => {
          if (estimate.usage === undefined) return;
          setUsage(`${(estimate.usage / 1024).toFixed(0)} KB`);
        })
        .catch(() => {});
    }
  }, []);

  const exportData = () => {
    const state = matchStore.get();
    const payload = {
      kind: "rummikub-turn-timer",
      // 2: the count-in cue changed shape. A v1 backup's sound cues are
      // dropped on import — see the note on VERSION in settings/store.ts.
      v: 2,
      exportedAt: new Date().toISOString(),
      settings: settingsStore.get(),
      match: state.status === "ready" ? state.match : null,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rummikub-timer-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    setMessage(null);
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.settings) {
        settingsStore.set(migrateSettings(parsed.settings, Number(parsed.v) || 1));
      }
      if (parsed?.match) importMatch(parsed.match);
      setMessage("Restored.");
    } catch {
      setMessage("That file couldn't be read.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <>
      <Section
        title="Your data"
        description="Everything lives on this device — nothing is sent anywhere."
      >
        {usage && <Row label="Storage used" control={<span className="numerals text-tile-face/70">{usage}</span>} />}

        <div className="flex flex-wrap gap-2 px-4 py-3">
          <Button variant="secondary" className="min-h-11" onClick={exportData}>
            Export a backup
          </Button>
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => fileInput.current?.click()}
          >
            Restore
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importData(file);
            }}
          />
        </div>

        {message && (
          <p className="px-4 pb-3 text-sm text-tile-face/70">{message}</p>
        )}

        {!installed && (
          <p className="px-4 pb-3 text-xs leading-relaxed text-tile-face/45">
            Tip: add this to your home screen. Besides launching full-screen and
            working offline, iPhone clears the saved data of sites you haven&rsquo;t
            opened in a week — installed apps are exempt.
          </p>
        )}
      </Section>

      <Section title="Reset">
        <div className="flex flex-wrap gap-2 px-4 py-3">
          <Button variant="ghost" className="min-h-11" onClick={resetSettings}>
            Reset settings
          </Button>
          <Button
            variant="ghost"
            className="min-h-11 text-ink-red"
            onClick={() => setConfirmClear(true)}
          >
            Delete everything
          </Button>
        </div>
      </Section>

      <ConfirmDialog
        open={confirmClear}
        title="Delete every player and score?"
        body="This removes the whole roster along with every round. Export a backup first if you might want it back."
        confirmLabel="Delete everything"
        destructive
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearAll();
          setConfirmClear(false);
        }}
      />
    </>
  );
}
